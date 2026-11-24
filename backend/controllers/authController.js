const User = require('../models/User');
const AppConfig = require('../models/AppConfig');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateFourDigitCode,
} = require('../utils/tokenUtils');

const DEFAULT_SUPPORT_CONTACT = {
  supportPhone: '+91-124-400-0100',
  supportWhatsApp: '+91-98110-00100',
  supportEmail: 'support@petjeeva.com',
  supportHours: 'Mon-Sun, 08:00 AM - 10:00 PM IST',
  emergencyHelpline: '+91-98110-00911',
};

// Step 1: First-time client registration -> generates 4-digit code & returns it for on-screen display
const registerInit = async (req, res, next) => {
  try {
    const { name, phone, password, email } = req.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, mobile number, and password are required.',
      });
    }

    const cleanPhone = String(phone).trim();
    if (!/^[0-9]{10,15}$/.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid mobile number (10-15 digits).',
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const config = await AppConfig.findOne({ configKey: 'GLOBAL_CONFIG' }).lean();
    const expiryMinutes = config?.operationalRules?.registrationCodeExpiryMinutes || 10;
    const verificationCode = generateFourDigitCode();
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    let user = await User.findOne({ phone: cleanPhone }).select('+password');

    if (user) {
      if (user.accountStatus === 'active' && user.isPhoneVerified) {
        return res.status(409).json({
          success: false,
          message: 'An active account with this mobile number already exists. Please sign in.',
        });
      }

      // Allow re-initiating verification for unverified or deleted accounts
      user.role = 'pet_parent';
      user.name = String(name).trim();
      user.email = email ? String(email).trim().toLowerCase() : user.email;
      user.password = String(password);
      user.registrationCode = verificationCode;
      user.registrationCodeExpiresAt = expiresAt;
      user.isPhoneVerified = false;
      user.accountStatus = 'pending_verification';
      user.authenticationMetadata.deletedAt = null;
      await user.save();
    } else {
      user = await User.create({
        role: 'pet_parent',
        name: String(name).trim(),
        phone: cleanPhone,
        email: email ? String(email).trim().toLowerCase() : '',
        password: String(password),
        walletBalance: 0,
        registrationCode: verificationCode,
        registrationCodeExpiresAt: expiresAt,
        isPhoneVerified: false,
        accountStatus: 'pending_verification',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Verification code generated. Enter the 4-digit code shown on screen to complete registration.',
      data: {
        tempUserId: user._id,
        phone: user.phone,
        verificationCode,
        expiresAt,
        expiresInMinutes: expiryMinutes,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Step 2: Verify on-screen 4-digit code & issue JWT access + refresh tokens
const verifyRegistration = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and 4-digit verification otp are required.',
      });
    }

    const cleanPhone = String(phone).trim();
    const cleanCode = String(otp).trim();

    const user = await User.findOne({ phone: cleanPhone }).select(
      '+registrationCode +registrationCodeExpiresAt +authenticationMetadata.refreshTokenHash +authenticationMetadata.refreshTokenExpiresAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Registration record not found for this mobile number.',
      });
    }

    if (!user.registrationCode || user.registrationCode !== cleanCode) {
      return res.status(400).json({
        success: false,
        message: 'Invalid 4-digit verification otp.',
      });
    }

    if (!user.registrationCodeExpiresAt || new Date() > new Date(user.registrationCodeExpiresAt)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please restart registration to generate a new otp.',
      });
    }

    user.isPhoneVerified = true;
    user.accountStatus = 'active';
    user.registrationCode = null;
    user.registrationCodeExpiresAt = null;

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.authenticationMetadata.lastLoginAt = new Date();
    user.authenticationMetadata.lastLoginIp = req.ip || '';
    user.authenticationMetadata.refreshTokenHash = hashToken(refreshToken);
    user.authenticationMetadata.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    const safeUser = await User.findById(user._id).select('-password');

    return res.status(200).json({
      success: true,
      message: 'Registration verified successfully.',
      data: {
        user: safeUser,
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Mobile number + Password login
const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and password are required.',
      });
    }

    const cleanPhone = String(phone).trim();
    const user = await User.findOne({ phone: cleanPhone }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.',
      });
    }

    if (user.accountStatus === 'pending_verification' && !user.isPhoneVerified) {
      return res.status(403).json({
        success: false,
        code: 'PENDING_VERIFICATION',
        message: 'Account verification is pending. Please complete 4-digit verification.',
      });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'Account is suspended. Please contact PetJeeva support.',
      });
    }

    if (user.accountStatus === 'deleted') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DELETED',
        message: 'This account has been deleted.',
      });
    }

    const isMatch = await user.matchPassword(String(password));
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.',
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.authenticationMetadata.lastLoginAt = new Date();
    user.authenticationMetadata.lastLoginIp = req.ip || '';
    user.authenticationMetadata.refreshTokenHash = hashToken(refreshToken);
    user.authenticationMetadata.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    const safeUser = await User.findById(user._id).select('-password');

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      data: {
        user: safeUser,
        accessToken,
        refreshToken,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Rotate refresh token
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.sub).select(
      '+authenticationMetadata.refreshTokenHash +authenticationMetadata.refreshTokenExpiresAt'
    );

    if (!user || user.accountStatus !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Session invalid or account inactive.',
      });
    }

    const incomingHash = hashToken(refreshToken);
    if (
      !user.authenticationMetadata?.refreshTokenHash ||
      user.authenticationMetadata.refreshTokenHash !== incomingHash
    ) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked or does not match.',
      });
    }

    if (
      user.authenticationMetadata.refreshTokenExpiresAt &&
      new Date() > new Date(user.authenticationMetadata.refreshTokenExpiresAt)
    ) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired. Please sign in again.',
      });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    user.authenticationMetadata.refreshTokenHash = hashToken(newRefreshToken);
    user.authenticationMetadata.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await user.save();

    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token.',
    });
  }
};

// Logout & invalidate refresh token
const logout = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        'authenticationMetadata.refreshTokenHash': null,
        'authenticationMetadata.refreshTokenExpiresAt': null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

// Play Store compliant account deletion
const deleteAccount = async (req, res, next) => {
  try {
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Administrator accounts cannot be self-deleted via mobile app.',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    user.accountStatus = 'deleted';
    user.isPhoneVerified = false;
    user.authenticationMetadata.deletedAt = new Date();
    user.authenticationMetadata.refreshTokenHash = null;
    user.authenticationMetadata.refreshTokenExpiresAt = null;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Your PetJeeva account has been deleted in compliance with data retention policies.',
    });
  } catch (err) {
    return next(err);
  }
};

// Public support contact for Forgot Password modal
const getSupportContact = async (req, res, next) => {
  try {
    const config = await AppConfig.findOne({ configKey: 'GLOBAL_CONFIG' }).lean();
    const supportContact = config?.supportContact || DEFAULT_SUPPORT_CONTACT;

    return res.status(200).json({
      success: true,
      data: {
        supportContact,
        instructions:
          'To reset your password, please contact our PetJeeva Admin & Support team using the phone, WhatsApp, or email details below.',
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  registerInit,
  verifyRegistration,
  login,
  refresh,
  logout,
  deleteAccount,
  getSupportContact,
};