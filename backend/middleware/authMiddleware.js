const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please sign in.',
        code: 'AUTH_TOKEN_MISSING',
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.sub).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account is suspended. Please contact PetJeeva support.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    if (user.accountStatus === 'deleted') {
      return res.status(403).json({
        success: false,
        message: 'This account has been deleted.',
        code: 'ACCOUNT_DELETED',
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please refresh your token or sign in again.',
        code: 'TOKEN_EXPIRED',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired authentication token.',
      code: 'TOKEN_INVALID',
    });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for your user role.',
        code: 'FORBIDDEN_ROLE',
      });
    }
    return next();
  };
};

module.exports = {
  protect,
  authorizeRoles,
};