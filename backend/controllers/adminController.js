const mongoose = require('mongoose');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const AppConfig = require('../models/AppConfig');
const ProfessionalProfile = require('../models/ProfessionalProfile');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const SupportTicket = require('../models/SupportTicket');

const PRO_ROLES = [
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
];

/**
 * POST /api/admin/wallet/credit
 * Admin adds or adjusts wallet balance for a client (pet_parent) or professional.
 * Body: { userId, amount, category?, description?, reason? }
 */
const creditUserWallet = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { userId, amount, category = 'admin_topup', description, reason } = req.body;
    const numericAmount = Number(amount);

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    let resultPayload = null;

    await mongoSession.withTransaction(async () => {
      const targetUser = await User.findById(userId).session(mongoSession);
      if (!targetUser) {
        const err = new Error('Target user not found');
        err.statusCode = 404;
        throw err;
      }

      const balanceBefore = Number(targetUser.walletBalance || 0);
      const balanceAfter = Number((balanceBefore + numericAmount).toFixed(2));
      targetUser.walletBalance = balanceAfter;
      await targetUser.save({ session: mongoSession });

      const walletRole = PRO_ROLES.includes(targetUser.role) ? 'professional' : 'client';
      const txCategory = ['admin_topup', 'refund', 'adjustment'].includes(category)
        ? category
        : 'admin_topup';

      const [tx] = await WalletTransaction.create(
        [
          {
            user: targetUser._id,
            role: walletRole,
            type: 'credit',
            category: txCategory,
            amount: numericAmount,
            balanceBefore,
            balanceAfter,
            performedBy: req.user._id,
            description:
              description ||
              `Admin wallet credit (${txCategory}) of ₹${numericAmount} for ${targetUser.name}`,
            metadata: {
              reason: reason || description || 'Admin wallet top-up',
            },
            referenceId: `ADMIN_TOPUP_${targetUser._id}_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2, 7)}`,
          },
        ],
        { session: mongoSession }
      );

      resultPayload = {
        userId: targetUser._id,
        name: targetUser.name,
        phone: targetUser.phone,
        role: targetUser.role,
        walletBalance: balanceAfter,
        transaction: tx,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Wallet balance credited successfully',
      data: resultPayload,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

/**
 * GET /api/admin/wallet/transactions
 * Admin views platform-wide wallet ledger entries.
 */
const getAllWalletTransactions = async (req, res, next) => {
  try {
    const { userId, type, category } = req.query;
    const filter = {};
    if (userId && mongoose.Types.ObjectId.isValid(userId)) filter.user = userId;
    if (type && ['credit', 'debit'].includes(type)) filter.type = type;
    if (category) filter.category = category;

    const transactions = await WalletTransaction.find(filter)
      .populate('user', 'name phone role walletBalance')
      .populate('performedBy', 'name phone role')
      .sort({ createdAt: -1 })
      .limit(200);

    return res.status(200).json({
      success: true,
      data: { transactions },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/users
 */
const listUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    const filter = {};
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select('-password -registrationCode -registrationCodeExpiresAt')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: { users } });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/admin/professionals/:id/verify
 * Verify or update professional credential status (`pending`, `verified`, `rejected`, `expired`).
 */
const updateProfessionalVerification = async (req, res, next) => {
  try {
    const { verificationStatus, isAvailable } = req.body;
    const profile = await ProfessionalProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Professional profile not found' });
    }

    if (verificationStatus) {
      if (!['pending', 'verified', 'rejected', 'expired'].includes(verificationStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid verification status' });
      }
      profile.verificationStatus = verificationStatus;
    }
    if (typeof isAvailable === 'boolean') {
      profile.isAvailable = isAvailable;
    }

    await profile.save();
    return res.status(200).json({ success: true, data: { profile } });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/admin/config/support-contact
 * Update support contact details shown on Forgot Password popup & Support Hub.
 */
const updateSupportConfig = async (req, res, next) => {
  try {
    const {
      supportPhone,
      supportWhatsApp,
      supportEmail,
      supportHours,
      forgotPasswordNotice,
      cancellationWindowHours,
      lateCancellationFeePercent,
    } = req.body;

    const config = await AppConfig.findOneAndUpdate(
      { key: 'global' },
      {
        $set: {
          ...(supportPhone !== undefined && { supportPhone }),
          ...(supportWhatsApp !== undefined && { supportWhatsApp }),
          ...(supportEmail !== undefined && { supportEmail }),
          ...(supportHours !== undefined && { supportHours }),
          ...(forgotPasswordNotice !== undefined && { forgotPasswordNotice }),
          ...(cancellationWindowHours !== undefined && {
            cancellationWindowHours: Number(cancellationWindowHours),
          }),
          ...(lateCancellationFeePercent !== undefined && {
            lateCancellationFeePercent: Number(lateCancellationFeePercent),
          }),
          updatedBy: req.user._id,
        },
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({ success: true, data: { config } });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/overview
 */
const getAdminOverview = async (_req, res, next) => {
  try {
    const [totalUsers, totalBookings, totalSessions, openTickets] = await Promise.all([
      User.countDocuments({}),
      Booking.countDocuments({}),
      Session.countDocuments({}),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    ]);

    return res.status(200).json({
      success: true,
      data: { totalUsers, totalBookings, totalSessions, openTickets },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  creditUserWallet,
  getAllWalletTransactions,
  listUsers,
  updateProfessionalVerification,
  updateSupportConfig,
  getAdminOverview,
};