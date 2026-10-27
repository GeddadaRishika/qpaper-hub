
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'question-papers';
const sqlitePath = path.join(__dirname, '../data/qpaper-hub.sqlite');

const sqlite = new Database(sqlitePath, { readonly: true });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

async function main() {
  for (const key of [
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    if (!process.env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }

  const counts = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM papers) AS papers,
      (SELECT COUNT(*) FROM saved_papers) AS saved_papers
  `);

  const existing = counts.rows[0];

  if (
    Number(existing.users) ||
    Number(existing.papers) ||
    Number(existing.saved_papers)
  ) {
    throw new Error(
      'Destination tables are not empty. Migration stopped to protect existing records.'
    );
  }

  const users = sqlite.prepare('SELECT * FROM users ORDER BY id').all();
  const papers = sqlite.prepare('SELECT * FROM papers ORDER BY id').all();
  const saved = sqlite
    .prepare('SELECT * FROM saved_papers ORDER BY id')
    .all();

  console.log(`Found ${users.length} users.`);
  console.log(`Found ${papers.length} papers.`);
  console.log(`Found ${saved.length} saved-paper records.`);

  // Upload PDFs first. Existing local files are never deleted.
  const migratedPaths = new Map();

  for (const paper of papers) {
    const localPath = path.resolve(
      __dirname,
      '..',
      paper.file_path
    );

    if (!fs.existsSync(localPath)) {
      throw new Error(
        `PDF missing for paper ${paper.id}: ${paper.file_path}`
      );
    }

    const filename = path.basename(localPath);
    const storagePath = `papers/${filename}`;
    const fileBuffer = fs.readFileSync(localPath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) {
      throw new Error(
        `Upload failed for paper ${paper.id}: ${error.message}`
      );
    }

    migratedPaths.set(paper.id, storagePath);
    console.log(`Uploaded PDF for paper ${paper.id}.`);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const user of users) {
      await client.query(
        `INSERT INTO users
          (id, name, email, password_hash, role, department,
           semester, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          user.id,
          user.name,
          user.email,
          user.password_hash,
          user.role,
          user.department,
          user.semester,
          user.created_at,
        ]
      );
    }

    for (const paper of papers) {
      await client.query(
        `INSERT INTO papers
          (id, title, subject, subject_code, department, semester,
           year, exam_type, file_path, uploaded_by, download_count,
           created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          paper.id,
          paper.title,
          paper.subject,
          paper.subject_code,
          paper.department,
          paper.semester,
          paper.year,
          paper.exam_type,
          migratedPaths.get(paper.id),
          paper.uploaded_by,
          paper.download_count,
          paper.created_at,
        ]
      );
    }

    for (const item of saved) {
      await client.query(
        `INSERT INTO saved_papers (id, user_id, paper_id, created_at)
         VALUES ($1,$2,$3,$4)`,
        [item.id, item.user_id, item.paper_id, item.created_at]
      );
    }

    // Preserve future auto-generated IDs after importing old IDs.
    for (const table of ['users', 'papers', 'saved_papers']) {
      await client.query(
        `SELECT setval(
          pg_get_serial_sequence($1, 'id'),
          COALESCE((SELECT MAX(id) FROM ${table}), 1),
          EXISTS (SELECT 1 FROM ${table})
        )`,
        [`public.${table}`]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  console.log('\nMigration completed successfully.');

  const verify = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM papers) AS papers,
      (SELECT COUNT(*) FROM saved_papers) AS saved_papers
  `);

  console.log('Supabase record counts:', verify.rows[0]);
  console.log('PDFs uploaded:', migratedPaths.size);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    sqlite.close();
    await pool.end();
  });
