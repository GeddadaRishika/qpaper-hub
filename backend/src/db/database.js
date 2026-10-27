const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'qpaper-hub.sqlite'));
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL CHECK(length(trim(name)) > 0),
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student','admin')),
    department TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK(semester BETWEEN 1 AND 8),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    department TEXT NOT NULL,
    semester INTEGER NOT NULL CHECK(semester BETWEEN 1 AND 8),
    year INTEGER NOT NULL CHECK(year BETWEEN 1990 AND 2100),
    exam_type TEXT NOT NULL CHECK(exam_type IN ('Mid-1','Mid-2','Semester','Supplementary')),
    file_path TEXT NOT NULL,
    uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    download_count INTEGER NOT NULL DEFAULT 0 CHECK(download_count >= 0),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS saved_papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, paper_id)
  );
  CREATE INDEX IF NOT EXISTS idx_papers_department ON papers(department);
  CREATE INDEX IF NOT EXISTS idx_papers_semester ON papers(semester);
  CREATE INDEX IF NOT EXISTS idx_papers_subject ON papers(subject);
  CREATE INDEX IF NOT EXISTS idx_papers_year ON papers(year);
  CREATE INDEX IF NOT EXISTS idx_papers_exam_type ON papers(exam_type);
  CREATE INDEX IF NOT EXISTS idx_papers_created_at ON papers(created_at);
  CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_papers(user_id);
`);
module.exports = db;
