
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { createClient } = require('@supabase/supabase-js');
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireAdmin);

const BUCKET = 'question-papers';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype !== 'application/pdf' ||
      !file.originalname.toLowerCase().endsWith('.pdf')
    ) {
      return cb(new Error('Only PDF files are allowed.'));
    }
    cb(null, true);
  },
});

const rules = [
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('subject').trim().notEmpty().withMessage('Subject is required.'),
  body('subject_code').trim().notEmpty().withMessage('Subject code is required.'),
  body('department').trim().notEmpty().withMessage('Department is required.'),
  body('semester').isInt({ min: 1, max: 8 })
    .withMessage('Semester must be between 1 and 8.'),
  body('year').isInt({ min: 1990, max: 2100 })
    .withMessage('Enter a valid exam year.'),
  body('exam_type').isIn(['Mid-1', 'Mid-2', 'Semester', 'Supplementary'])
    .withMessage('Select a valid exam type.'),
];

const valid = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
    });
  }
  next();
};

async function uploadPdf(file) {
  const storagePath = `papers/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (error) throw error;
  return storagePath;
}

async function deletePdf(storagePath) {
  if (!storagePath) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    console.error('Could not delete stored PDF:', error.message);
  }
}

router.post('/papers', upload.single('pdf'), rules, valid, async (req, res, next) => {
  let storagePath;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please choose a PDF file.',
      });
    }

    const b = req.body;
    storagePath = await uploadPdf(req.file);

    const result = await db.query(
      `INSERT INTO papers
        (title, subject, subject_code, department, semester, year,
         exam_type, file_path, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        b.title, b.subject, b.subject_code, b.department,
        Number(b.semester), Number(b.year), b.exam_type,
        storagePath, req.user.id,
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Question paper uploaded.',
      paper: result.rows[0],
    });
  } catch (err) {
    if (storagePath) await deletePdf(storagePath);
    next(err);
  }
});

router.put('/papers/:id', upload.single('pdf'), rules, valid, async (req, res, next) => {
  let newStoragePath;

  try {
    const id = Number(req.params.id);
    const found = await db.query('SELECT * FROM papers WHERE id = $1', [id]);
    const paper = found.rows[0];

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Question paper not found.',
      });
    }

    const b = req.body;
    let filePath = paper.file_path;

    if (req.file) {
      newStoragePath = await uploadPdf(req.file);
      filePath = newStoragePath;
    }

    const result = await db.query(
      `UPDATE papers
       SET title=$1, subject=$2, subject_code=$3, department=$4,
           semester=$5, year=$6, exam_type=$7, file_path=$8
       WHERE id=$9
       RETURNING *`,
      [
        b.title, b.subject, b.subject_code, b.department,
        Number(b.semester), Number(b.year), b.exam_type,
        filePath, id,
      ]
    );

    if (newStoragePath) await deletePdf(paper.file_path);

    return res.json({
      success: true,
      message: 'Question paper updated.',
      paper: result.rows[0],
    });
  } catch (err) {
    if (newStoragePath) await deletePdf(newStoragePath);
    next(err);
  }
});

router.delete('/papers/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const found = await db.query('SELECT * FROM papers WHERE id = $1', [id]);
    const paper = found.rows[0];

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Question paper not found.',
      });
    }

    await db.query('DELETE FROM papers WHERE id = $1', [id]);
    await deletePdf(paper.file_path);

    return res.json({
      success: true,
      message: 'Question paper deleted.',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, role, department, semester, created_at
       FROM users ORDER BY created_at DESC`
    );

    return res.json({ success: true, users: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const [papers, users, downloads, departments] = await Promise.all([
      db.query('SELECT COUNT(*) AS n FROM papers'),
      db.query('SELECT COUNT(*) AS n FROM users'),
      db.query('SELECT COALESCE(SUM(download_count),0) AS n FROM papers'),
      db.query(
        `SELECT department, COUNT(*) AS count
         FROM papers GROUP BY department ORDER BY count DESC`
      ),
    ]);

    return res.json({
      success: true,
      stats: {
        totalPapers: Number(papers.rows[0].n),
        totalUsers: Number(users.rows[0].n),
        totalDownloads: Number(downloads.rows[0].n),
        departments: departments.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
