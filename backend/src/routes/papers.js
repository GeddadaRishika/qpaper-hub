
const express = require('express');
const db = require('../db/database');
const { createClient } = require('@supabase/supabase-js');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const BUCKET = 'question-papers';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const selectPaper = `
  SELECT p.*, u.name AS uploader_name
  FROM papers p
  LEFT JOIN users u ON u.id = p.uploaded_by
`;

async function getPdfUrl(filePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60);

  if (error) throw error;
  return data.signedUrl;
}

router.get('/', async (req, res, next) => {
  try {
    const {
      department, semester, subject, year, exam_type,
      q = '', sort = 'newest',
    } = req.query;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = 10;
    const where = [];
    const params = [];

    const addFilter = (sql, value) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };

    if (department) addFilter('p.department = ?', department);
    if (semester) addFilter('p.semester = ?', Number(semester));
    if (subject) addFilter('p.subject = ?', subject);
    if (year) addFilter('p.year = ?', Number(year));
    if (exam_type) addFilter('p.exam_type = ?', exam_type);

    if (q.trim()) {
      params.push(`%${q.trim()}%`);
      const n = params.length;
      where.push(`(p.title ILIKE $${n} OR p.subject ILIKE $${n} OR p.subject_code ILIKE $${n})`);
    }

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const order = sort === 'downloads'
      ? 'p.download_count DESC, p.created_at DESC'
      : 'p.created_at DESC, p.id DESC';

    const totalResult = await db.query(
      `SELECT COUNT(*) AS n FROM papers p ${clause}`, params
    );

    const listParams = [...params, limit, (page - 1) * limit];

    const papersResult = await db.query(
      `${selectPaper} ${clause} ORDER BY ${order}
       LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams
    );

    return res.json({
      success: true,
      papers: papersResult.rows,
      pagination: {
        page,
        limit,
        total: Number(totalResult.rows[0].n),
        totalPages: Math.ceil(Number(totalResult.rows[0].n) / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/preview', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM papers WHERE id = $1',
      [Number(req.params.id)]
    );

    const paper = result.rows[0];
    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Question paper not found.',
      });
    }

    const url = await getPdfUrl(paper.file_path);
    return res.redirect(url);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `${selectPaper} WHERE p.id = $1`,
      [Number(req.params.id)]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: 'Question paper not found.',
      });
    }

    return res.json({ success: true, paper: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/download', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM papers WHERE id = $1',
      [Number(req.params.id)]
    );

    const paper = result.rows[0];
    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Question paper not found.',
      });
    }

    const url = await getPdfUrl(paper.file_path);

    await db.query(
      'UPDATE papers SET download_count = download_count + 1 WHERE id = $1',
      [paper.id]
    );

    return res.redirect(url);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/save', authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const paper = await db.query(
      'SELECT id FROM papers WHERE id = $1',
      [id]
    );

    if (!paper.rowCount) {
      return res.status(404).json({
        success: false,
        message: 'Question paper not found.',
      });
    }

    await db.query(
      'INSERT INTO saved_papers (user_id, paper_id) VALUES ($1, $2)',
      [req.user.id, id]
    );

    return res.status(201).json({
      success: true,
      message: 'Paper saved.',
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Paper is already saved.',
      });
    }
    next(err);
  }
});

router.delete('/:id/save', authenticate, async (req, res, next) => {
  try {
    await db.query(
      'DELETE FROM saved_papers WHERE user_id = $1 AND paper_id = $2',
      [req.user.id, Number(req.params.id)]
    );

    return res.json({
      success: true,
      message: 'Paper removed from saved list.',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
