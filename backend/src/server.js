
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required. Set it in your environment.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it in your environment.');
  process.exit(1);
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
  );
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const db = require('./db/database');
const authRoutes = require('./routes/auth');
const paperRoutes = require('./routes/papers');
const adminRoutes = require('./routes/admin');
const { notFound, errorHandler } = require('./middleware/errors');
const { authenticate } = require('./middleware/auth');

const app = express();

// Security headers and PDF preview permissions
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'frame-ancestors': [
  "'self'",
  ...(process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:5173']),
],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
      : 'http://localhost:5173',
  })
);

app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');

    res.json({
      success: true,
      message: 'QPaper Hub API is running.',
      database: 'connected',
    });
  } catch (err) {
    console.error('Health check database error:', err.message);

    res.status(503).json({
      success: false,
      message: 'API is running, but the database is unavailable.',
    });
  }
});

// Authentication routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes);

// Saved papers
app.get('/api/saved', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT p.*, u.name AS uploader_name
       FROM papers p
       LEFT JOIN users u ON u.id = p.uploaded_by
       JOIN saved_papers s ON s.paper_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      papers: result.rows,
    });
  } catch (err) {
    next(err);
  }
});

// Question paper routes
app.use('/api/papers', paperRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
if (require.main === module) {
  const port = Number(process.env.PORT) || 8000;

  app.listen(port, () => {
    console.log(`QPaper Hub API listening on port ${port}`);
  });
}

module.exports = app;
