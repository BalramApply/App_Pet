const mongoose = require('mongoose');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Service = require('../models/Service');
const Package = require('../models/Package');
const AppConfig = require('../models/AppConfig');
const { adjustWalletByAdmin } = require('../utils/walletSettlement');

const getMyWalletBalance = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('name phone role walletBalance').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      data: {
        userId: user._id,
        role: user.role,
        walletBalance: Number(user.walletBalance || 0),
        currency: 'INR',
      },
    });
  } catch (err) {
    return next(err);
  }
};

const getMyWalletTransactions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = { user: req.user._id };

    if (req.query.type && ['credit', 'debit'].includes(req.query.type)) {
      filter.type = req.query.type;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(filter)
        .populate('booking', 'bookingType scheduledDate timeSlot status')
        .populate('session', 'sessionNumber status sessionAmount professionalPayoutAmount')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Admin: Credit or adjust wallet balance for any Client or Professional
const adminCreditWallet = async (req, res, next) => {
  try {
    const { userId, phone, amount, type = 'credit', category = 'admin_topup', description, note } =
      req.body;

    let targetUser = null;
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid userId.' });
      }
      targetUser = await User.findById(userId).select('_id').lean();
    } else if (phone) {
      targetUser = await User.findOne({ phone: String(phone).trim() }).select('_id').lean();
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target user not found.' });
    }

    const result = await adjustWalletByAdmin({
      targetUserId: targetUser._id,
      adminUserId: req.user._id,
      amount,
      type,
      category,
      description,
      note,
    });

    return res.status(200).json({
      success: true,
      message: `Wallet ${type === 'credit' ? 'credited' : 'debited'} successfully.`,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
};

// Admin: View all wallet transactions across the platform
const adminListWalletTransactions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const filter = {};

    if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId)) {
      filter.user = req.query.userId;
    }
    if (req.query.type && ['credit', 'debit'].includes(req.query.type)) {
      filter.type = req.query.type;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const [transactions, total] = await Promise.all([
      WalletTransaction.find(filter)
        .populate('user', 'name phone role walletBalance')
        .populate('performedBy', 'name phone role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WalletTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Admin: List users & update account status / role / RM assignment
const adminListUsers = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.accountStatus) filter.accountStatus = req.query.accountStatus;

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return res.status(200).json({
      success: true,
      data: { users },
    });
  } catch (err) {
    return next(err);
  }
};

const adminUpdateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role, accountStatus, assignedRelationshipManager } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (role) user.role = role;
    if (accountStatus) user.accountStatus = accountStatus;
    if (assignedRelationshipManager !== undefined) {
      user.profile.assignedRelationshipManager = assignedRelationshipManager || null;
    }

    await user.save();
    const safeUser = await User.findById(user._id).select('-password').lean();

    return res.status(200).json({
      success: true,
      message: 'User updated by Admin.',
      data: { user: safeUser },
    });
  } catch (err) {
    return next(err);
  }
};

// Admin: Update AppConfig (Forgot Password support contact & platform rules)
const adminUpdateAppConfig = async (req, res, next) => {
  try {
    const { supportContact, operationalRules, policyDocuments } = req.body;
    const updateDoc = { updatedBy: req.user._id };

    if (supportContact) {
      updateDoc.supportContact = supportContact;
    }
    if (operationalRules) {
      updateDoc.operationalRules = operationalRules;
    }
    if (policyDocuments) {
      updateDoc.policyDocuments = policyDocuments;
    }

    const config = await AppConfig.findOneAndUpdate(
      { configKey: 'GLOBAL_CONFIG' },
      { $set: updateDoc },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: 'App configuration updated.',
      data: { config },
    });
  } catch (err) {
    return next(err);
  }
};

// Catalog: Services & Packages
const listServices = async (req, res, next) => {
  try {
    const filter = { activeStatus: true };
    if (req.query.type) {
      filter.type = req.query.type;
    }
    if (req.query.species) {
      filter.targetSpecies = req.query.species;
    }

    const services = await Service.find(filter).sort({ type: 1, createdAt: 1 }).lean();
    return res.status(200).json({
      success: true,
      data: { services },
    });
  } catch (err) {
    return next(err);
  }
};

const listPackages = async (req, res, next) => {
  try {
    const filter = { activeStatus: true };
    if (req.query.serviceId && mongoose.Types.ObjectId.isValid(req.query.serviceId)) {
      filter.service = req.query.serviceId;
    }
    if (req.query.species) {
      filter.species = req.query.species;
    }

    const packages = await Package.find(filter)
      .populate('service', 'type code title sessionDuration')
      .sort({ price: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { packages },
    });
  } catch (err) {
    return next(err);
  }
};

const createService = async (req, res, next) => {
  try {
    const service = await Service.create(req.body);
    return res.status(201).json({ success: true, data: { service } });
  } catch (err) {
    return next(err);
  }
};

const createPackage = async (req, res, next) => {
  try {
    const {
      name,
      description,
      service,
      serviceId,
      species,
      sessionCount,
      sessionDuration,
      price,
      trainerPayoutPerSession,
      freeDemoEligible,
      activeStatus,
      isActive,
    } = req.body;

    if (!name || sessionCount === undefined || sessionCount === null || price === undefined || price === null) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'name, sessionCount, and price are required.',
      });
    }

    const rawService = service || serviceId;
    let serviceDoc = null;

    if (rawService) {
      if (mongoose.Types.ObjectId.isValid(rawService)) {
        serviceDoc = await Service.findById(rawService);
      } else if (typeof rawService === 'string') {
        const trimmed = rawService.trim();
        serviceDoc = await Service.findOne({
          $or: [
            { type: new RegExp(`^${trimmed}$`, 'i') },
            { code: trimmed.toUpperCase() },
          ],
        });
      }
    }

    if (!serviceDoc) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_SERVICE',
        message: 'Valid service ID or service type (Training, Walking, Grooming, Vaccination) is required.',
      });
    }

    const numericSessionCount = Number(sessionCount);
    const numericPrice = Number(price);

    if (!Number.isFinite(numericSessionCount) || numericSessionCount < 1) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'sessionCount must be a number greater than or equal to 1.',
      });
    }

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'price must be a non-negative number.',
      });
    }

    const resolvedDuration =
      sessionDuration !== undefined && sessionDuration !== null && sessionDuration !== ''
        ? Number(sessionDuration)
        : Number(serviceDoc.sessionDuration);

    const perSessionPrice = numericPrice / numericSessionCount;
    const resolvedPayout =
      trainerPayoutPerSession !== undefined &&
      trainerPayoutPerSession !== null &&
      trainerPayoutPerSession !== ''
        ? Number(trainerPayoutPerSession)
        : Math.round(perSessionPrice * 0.7);

    const resolvedActive =
      activeStatus !== undefined
        ? Boolean(activeStatus)
        : isActive !== undefined
          ? Boolean(isActive)
          : true;

    const pkg = await Package.create({
      service: serviceDoc._id,
      name: String(name).trim(),
      description: description !== undefined ? String(description).trim() : '',
      species: species || serviceDoc.targetSpecies || ['dog'],
      sessionCount: numericSessionCount,
      sessionDuration: resolvedDuration,
      price: numericPrice,
      trainerPayoutPerSession: resolvedPayout,
      freeDemoEligible: Boolean(freeDemoEligible),
      activeStatus: resolvedActive,
    });

    return res.status(201).json({ success: true, data: { package: pkg } });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getMyWalletBalance,
  getMyWalletTransactions,
  adminCreditWallet,
  adminListWalletTransactions,
  adminListUsers,
  adminUpdateUser,
  adminUpdateAppConfig,
  listServices,
  listPackages,
  createService,
  createPackage,
};