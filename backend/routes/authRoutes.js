const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  registerInit,
  verifyRegistration,
  login,
  refresh,
  logout,
  deleteAccount,
  getSupportContact,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

router.post('/register-init', authLimiter, registerInit);
router.post('/verify-registration', authLimiter, verifyRegistration);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', protect, logout);
router.delete('/account', protect, deleteAccount);

module.exports = router;