
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  department: u.department,
  semester: u.semester,
  created_at: u.created_at,
});

const validation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 })
    .withMessage('Name must contain 2–100 characters.'),
  body('email').trim().isEmail()
    .withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').isLength({ min: 8, max: 100 })
    .withMessage('Password must be at least 8 characters.'),
  body('department').trim().notEmpty()
    .withMessage('Department is required.'),
  body('semester').isInt({ min: 1, max: 8 })
    .withMessage('Semester must be between 1 and 8.'),
], validation, async (req, res, next) => {
  try {
    const { name, email, password, department, semester } = req.body;

    const existing = await db.query(
      'SELECT id FROM users WHERE lower(email) = lower($1)',
      [email]
    );

    if (existing.rowCount) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO users
        (name, email, password_hash, role, department, semester)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, passwordHash, 'student', department, Number(semester)]
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: publicUser(result.rows[0]),
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }
    next(err);
  }
});

router.post('/login', [
  body('email').trim().isEmail()
    .withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').notEmpty()
    .withMessage('Password is required.'),
], validation, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE lower(email) = lower($1)',
      [req.body.email]
    );

    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
      return res.status(401).json({
        success: false,
        message: 'Email or password is incorrect.',
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    return res.json({
      success: true,
      message: 'Welcome back.',
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    return res.json({
      success: true,
      user: publicUser(result.rows[0]),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
