const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @route   POST /api/auth/signup
// @desc    Register new user
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    console.log('🔐 Signup attempt:', { email: req.body.email, name: req.body.name, hasPassword: !!req.body.password });
    const { email, password, name } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Create user
    console.log('🔐 Creating user...');
    const user = await User.create({ email, password, name });
    console.log('✅ User created successfully:', { id: user.id, email: user.email });

    // Generate token
    console.log('🔐 Generating JWT token...');
    const token = generateToken(user.id);
    console.log('✅ Token generated successfully');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    
    if (error.message === 'User already exists with this email') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during signup'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Authenticate user
    const user = await User.authenticate(email, password);

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user,
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    
    if (error.message === 'Invalid email or password') {
      return res.status(401).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user
    }
  });
});

// @route   POST /api/auth/verify
// @desc    Verify token
// @access  Private
router.post('/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: req.user
    }
  });
});

module.exports = router;
