const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
const selectPaper = `SELECT p.*, u.name AS uploader_name FROM papers p LEFT JOIN users u ON u.id=p.uploaded_by`;
router.get('/', (req, res) => {
  const { department, semester, subject, year, exam_type, q = '', sort = 'newest' } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = 10;
  const where = [], params = [];
  if (department) { where.push('p.department = ?'); params.push(department); }
  if (semester) { where.push('p.semester = ?'); params.push(Number(semester)); }
  if (subject) { where.push('p.subject = ?'); params.push(subject); }
  if (year) { where.push('p.year = ?'); params.push(Number(year)); }
  if (exam_type) { where.push('p.exam_type = ?'); params.push(exam_type); }
  if (q.trim()) { where.push('(p.title LIKE ? OR p.subject LIKE ? OR p.subject_code LIKE ?)'); params.push(`%${q.trim()}%`,`%${q.trim()}%`,`%${q.trim()}%`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const order = sort === 'downloads' ? 'p.download_count DESC, p.created_at DESC' : 'p.created_at DESC, p.id DESC';
  const total = db.prepare(`SELECT COUNT(*) AS n FROM papers p ${clause}`).get(...params).n;
  const papers = db.prepare(`${selectPaper} ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`).all(...params, limit, (page-1)*limit);
  res.json({ success: true, papers, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } });
});
router.get('/:id/preview', (req, res) => {
  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(Number(req.params.id));
  if (!paper) return res.status(404).json({ success: false, message: 'Question paper not found.' });
  const file = path.resolve(__dirname, '../../', paper.file_path);
  if (!fs.existsSync(file)) return res.status(404).json({ success: false, message: 'The PDF file is missing from the server.' });
  res.sendFile(file, {
  headers: {
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline'
  }
});
});
router.get('/:id', (req, res) => {
  const paper = db.prepare(`${selectPaper} WHERE p.id = ?`).get(Number(req.params.id));
  if (!paper) return res.status(404).json({ success: false, message: 'Question paper not found.' });
  res.json({ success: true, paper });
});
router.get('/:id/download', authenticate, (req, res) => {
  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(Number(req.params.id));
  if (!paper) return res.status(404).json({ success: false, message: 'Question paper not found.' });
  const file = path.resolve(__dirname, '../../', paper.file_path);
  if (!fs.existsSync(file)) return res.status(404).json({ success: false, message: 'The PDF file is missing from the server.' });
  db.prepare('UPDATE papers SET download_count = download_count + 1 WHERE id = ?').run(paper.id);
  res.download(file, `${paper.subject_code}-${paper.year}.pdf`);
});
router.post('/:id/save', authenticate, (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT id FROM papers WHERE id = ?').get(id)) return res.status(404).json({ success: false, message: 'Question paper not found.' });
  try { db.prepare('INSERT INTO saved_papers (user_id,paper_id) VALUES (?,?)').run(req.user.id, id); }
  catch (e) { if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ success: false, message: 'Paper is already saved.' }); throw e; }
  res.status(201).json({ success: true, message: 'Paper saved.' });
});
router.delete('/:id/save', authenticate, (req, res) => {
  db.prepare('DELETE FROM saved_papers WHERE user_id = ? AND paper_id = ?').run(req.user.id, Number(req.params.id));
  res.json({ success: true, message: 'Paper removed from saved list.' });
});
module.exports = router;
