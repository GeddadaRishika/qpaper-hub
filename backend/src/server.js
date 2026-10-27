
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required. Copy .env.example to .env and set a secret.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/auth');
const paperRoutes = require('./routes/papers');
const adminRoutes = require('./routes/admin');
const { notFound, errorHandler } = require('./middleware/errors');

// Initialize Express BEFORE using app.use()
const app = express();

// Security headers and PDF preview permissions

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'frame-ancestors': ["'self'", 'http://localhost:5173'],
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
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'QPaper Hub API is running.',
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authRoutes);

// Saved papers
app.get(
  '/api/saved',
  require('./middleware/auth').authenticate,
  (req, res) => {
    const db = require('./db/database');

    const papers = db.prepare(`
      SELECT p.*, u.name AS uploader_name
      FROM papers p
      LEFT JOIN users u ON u.id = p.uploaded_by
      JOIN saved_papers s ON s.paper_id = p.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `).all(req.user.id);

    res.json({ success: true, papers });
  }
);

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
