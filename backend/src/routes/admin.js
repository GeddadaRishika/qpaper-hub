const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate, requireAdmin);
const uploadRoot = path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadRoot, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadRoot),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${require('crypto').randomBytes(6).toString('hex')}.pdf`)
});
const upload = multer({ storage, limits: { fileSize: 10*1024*1024 }, fileFilter: (req,file,cb) => {
  if (file.mimetype !== 'application/pdf' || !file.originalname.toLowerCase().endsWith('.pdf')) return cb(new Error('Only PDF files are allowed.'));
  cb(null, true);
}});
const rules = [
  body('title').trim().notEmpty().withMessage('Title is required.'),
  body('subject').trim().notEmpty().withMessage('Subject is required.'),
  body('subject_code').trim().notEmpty().withMessage('Subject code is required.'),
  body('department').trim().notEmpty().withMessage('Department is required.'),
  body('semester').isInt({min:1,max:8}).withMessage('Semester must be between 1 and 8.'),
  body('year').isInt({min:1990,max:2100}).withMessage('Enter a valid exam year.'),
  body('exam_type').isIn(['Mid-1','Mid-2','Semester','Supplementary']).withMessage('Select a valid exam type.')
];
const valid = (req,res,next) => { const e=validationResult(req); if(!e.isEmpty()) return res.status(400).json({success:false,message:e.array()[0].msg}); next(); };
router.post('/papers', upload.single('pdf'), rules, valid, (req,res) => {
  if (!req.file) return res.status(400).json({success:false,message:'Please choose a PDF file.'});
  const b=req.body, filePath=path.relative(path.resolve(__dirname,'../..'),req.file.path);
  const result=db.prepare('INSERT INTO papers(title,subject,subject_code,department,semester,year,exam_type,file_path,uploaded_by) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(b.title,b.subject,b.subject_code,b.department,Number(b.semester),Number(b.year),b.exam_type,filePath,req.user.id);
  res.status(201).json({success:true,message:'Question paper uploaded.',paper:db.prepare('SELECT * FROM papers WHERE id=?').get(result.lastInsertRowid)});
});
router.put('/papers/:id', upload.single('pdf'), rules, valid, (req,res) => {
  const paper=db.prepare('SELECT * FROM papers WHERE id=?').get(Number(req.params.id));
  if(!paper) { if(req.file) fs.unlinkSync(req.file.path); return res.status(404).json({success:false,message:'Question paper not found.'}); }
  const b=req.body; let filePath=paper.file_path;
  if(req.file) {
    filePath=path.relative(path.resolve(__dirname,'../..'),req.file.path);
    const old=path.resolve(__dirname,'../../',paper.file_path); if(fs.existsSync(old)) fs.unlinkSync(old);
  }
  db.prepare('UPDATE papers SET title=?,subject=?,subject_code=?,department=?,semester=?,year=?,exam_type=?,file_path=? WHERE id=?')
    .run(b.title,b.subject,b.subject_code,b.department,Number(b.semester),Number(b.year),b.exam_type,filePath,paper.id);
  res.json({success:true,message:'Question paper updated.',paper:db.prepare('SELECT * FROM papers WHERE id=?').get(paper.id)});
});
router.delete('/papers/:id', (req,res) => {
  const paper=db.prepare('SELECT * FROM papers WHERE id=?').get(Number(req.params.id));
  if(!paper) return res.status(404).json({success:false,message:'Question paper not found.'});
  db.prepare('DELETE FROM papers WHERE id=?').run(paper.id);
  const file=path.resolve(__dirname,'../../',paper.file_path); if(fs.existsSync(file)) fs.unlinkSync(file);
  res.json({success:true,message:'Question paper deleted.'});
});
router.get('/users', (req,res) => {
  const users=db.prepare('SELECT id,name,email,role,department,semester,created_at FROM users ORDER BY created_at DESC').all();
  res.json({success:true,users});
});
router.get('/stats', (req,res) => {
  const totalPapers=db.prepare('SELECT COUNT(*) n FROM papers').get().n;
  const totalUsers=db.prepare('SELECT COUNT(*) n FROM users').get().n;
  const totalDownloads=db.prepare('SELECT COALESCE(SUM(download_count),0) n FROM papers').get().n;
  const departments=db.prepare('SELECT department,COUNT(*) AS count FROM papers GROUP BY department ORDER BY count DESC').all();
  res.json({success:true,stats:{totalPapers,totalUsers,totalDownloads,departments}});
});
module.exports=router;
