const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const ProfessionalProfile = require('../models/ProfessionalProfile');
const Pet = require('../models/Pet');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const SupportTicket = require('../models/SupportTicket');
const WalletTransaction = require('../models/WalletTransaction');

const PROFESSIONAL_ROLES = [
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
];
const MANAGEABLE_ROLES = ['pet_parent', ...PROFESSIONAL_ROLES];
const ASSIGNABLE_STATUSES = ['active', 'suspended'];
const OPEN_SESSION_STATUSES = ['scheduled', 'professional_arrived', 'in_progress'];

const httpError = (statusCode, message, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toCountMap = (rows) =>
  rows.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

const round2 = (n) => Number(Number(n || 0).toFixed(2));

// Day boundaries in IST (UTC+05:30), independent of the server timezone
const istDayRange = (now = new Date()) => {
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const shifted = new Date(now.getTime() + offsetMs);
  const startShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  );
  const start = new Date(startShifted - offsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

const generateTempPassword = () => crypto.randomBytes(6).toString('base64url');

const revokeRefreshToken = (userId) =>
  User.updateOne(
    { _id: userId },
    {
      $set: {
        'authenticationMetadata.refreshTokenHash': null,
        'authenticationMetadata.refreshTokenExpiresAt': null,
      },
    }
  );

const assertValidId = (id, label = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `Invalid ${label}.`, 'INVALID_ID');
  }
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { start: todayStart, end: todayEnd } = istDayRange(now);

    const countBy = (Model, field, match = {}) =>
      Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);

    const sumLedger = (match) =>
      WalletTransaction.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]);

    const [
      usersByRole,
      usersByStatus,
      newUsers7d,
      profilesByStatus,
      bookingsByStatus,
      bookings7d,
      sessionsByStatus,
      sessionsToday,
      unsettledCompleted,
      ticketsByPriority,
      openSos,
      balanceBuckets,
      revenue30d,
      topups30d,
    ] = await Promise.all([
      countBy(User, 'role', { accountStatus: { $ne: 'deleted' } }),
      countBy(User, 'accountStatus'),
      User.countDocuments({ role: 'pet_parent', createdAt: { $gte: sevenDaysAgo } }),
      countBy(ProfessionalProfile, 'verificationStatus'),
      countBy(Booking, 'status'),
      Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      countBy(Session, 'status'),
      Session.countDocuments({
        scheduledDate: { $gte: todayStart, $lt: todayEnd },
        status: { $ne: 'cancelled' },
      }),
      Session.countDocuments({ status: 'completed', walletSettled: false }),
      countBy(SupportTicket, 'priority', { status: { $in: ['open', 'in_review'] } }),
      SupportTicket.countDocuments({
        type: 'emergency_sos',
        status: { $in: ['open', 'in_review'] },
      }),
      User.aggregate([
        { $match: { accountStatus: { $ne: 'deleted' } } },
        {
          $group: {
            _id: {
              $cond: [
                { $in: ['$role', PROFESSIONAL_ROLES] },
                'professional',
                { $cond: [{ $eq: ['$role', 'pet_parent'] }, 'client', 'other'] },
              ],
            },
            total: { $sum: '$walletBalance' },
          },
        },
      ]),
      sumLedger({ category: 'session_payment', type: 'debit', createdAt: { $gte: thirtyDaysAgo } }),
      sumLedger({ category: 'admin_topup', type: 'credit', createdAt: { $gte: thirtyDaysAgo } }),
    ]);

    const balanceMap = balanceBuckets.reduce((acc, row) => {
      acc[row._id] = round2(row.total);
      return acc;
    }, {});

    const ticketMap = toCountMap(ticketsByPriority);
    const openTickets = Object.values(ticketMap).reduce((a, b) => a + b, 0);
    const profileMap = toCountMap(profilesByStatus);

    return res.status(200).json({
      success: true,
      data: {
        generatedAt: now.toISOString(),
        users: {
          byRole: toCountMap(usersByRole),
          byStatus: toCountMap(usersByStatus),
          newPetParentsLast7Days: newUsers7d,
        },
        professionals: {
          pendingVerification: profileMap.pending || 0,
          verified: profileMap.verified || 0,
          rejected: profileMap.rejected || 0,
          expired: profileMap.expired || 0,
        },
        bookings: {
          byStatus: toCountMap(bookingsByStatus),
          createdLast7Days: bookings7d,
        },
        sessions: {
          byStatus: toCountMap(sessionsByStatus),
          scheduledToday: sessionsToday,
          completedButUnsettled: unsettledCompleted,
        },
        support: {
          openTickets,
          openByPriority: ticketMap,
          openSos,
        },
        wallet: {
          clientBalanceTotal: balanceMap.client || 0,
          professionalBalanceTotal: balanceMap.professional || 0,
          sessionRevenueLast30Days: round2(revenue30d[0]?.total),
          settledSessionsLast30Days: revenue30d[0]?.count || 0,
          adminTopupsLast30Days: round2(topups30d[0]?.total),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const adminListUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};

    if (req.query.role) filter.role = req.query.role;
    if (req.query.accountStatus) filter.accountStatus = req.query.accountStatus;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      filter.$or = [{ name: rx }, { phone: rx }, { email: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const proIds = users.filter((u) => PROFESSIONAL_ROLES.includes(u.role)).map((u) => u._id);
    const profiles = proIds.length
      ? await ProfessionalProfile.find({ user: { $in: proIds } })
          .select('user verificationStatus isAvailable averageRating completionPercentage')
          .lean()
      : [];
    const profileByUser = new Map(profiles.map((p) => [p.user.toString(), p]));

    const items = users.map((u) => ({
      ...u,
      professionalProfile: profileByUser.get(u._id.toString()) || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        users: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    return next(err);
  }
};

const adminGetUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    assertValidId(userId, 'userId');

    const user = await User.findById(userId)
      .select('-password')
      .populate('profile.assignedRelationshipManager', 'name phone role')
      .lean();
    if (!user) throw httpError(404, 'User not found.');

    const isPro = PROFESSIONAL_ROLES.includes(user.role);
    const bookingField = isPro ? 'assignedProfessional' : 'user';
    const sessionField = isPro ? 'professional' : 'customer';

    const [professionalProfile, petCount, bookingCount, openSessionCount, recentTransactions] =
      await Promise.all([
        isPro ? ProfessionalProfile.findOne({ user: user._id }).lean() : null,
        Pet.countDocuments({ user: user._id, isActive: true }),
        Booking.countDocuments({ [bookingField]: user._id }),
        Session.countDocuments({
          [sessionField]: user._id,
          status: { $in: OPEN_SESSION_STATUSES },
        }),
        WalletTransaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(5).lean(),
      ]);

    return res.status(200).json({
      success: true,
      data: {
        user,
        professionalProfile,
        counts: { pets: petCount, bookings: bookingCount, openSessions: openSessionCount },
        recentTransactions,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// Staff creation (professionals are never self-registered)
// ---------------------------------------------------------------------------
const adminCreateStaff = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { name, phone, email, role, password } = req.body;

    if (!name || String(name).trim().length < 2) {
      throw httpError(400, 'Name must be at least 2 characters.');
    }
    const cleanPhone = String(phone || '').trim();
    if (!/^[0-9]{10,15}$/.test(cleanPhone)) {
      throw httpError(400, 'Please provide a valid mobile number (10-15 digits).');
    }
    if (!PROFESSIONAL_ROLES.includes(role)) {
      throw httpError(400, `role must be one of: ${PROFESSIONAL_ROLES.join(', ')}.`);
    }
    if (password !== undefined && String(password).length < 6) {
      throw httpError(400, 'Password must be at least 6 characters.');
    }

    const generated = password === undefined || password === '';
    const finalPassword = generated ? generateTempPassword() : String(password);
    let createdId = null;

    await mongoSession.withTransaction(async () => {
      const existing = await User.findOne({ phone: cleanPhone }).session(mongoSession);
      if (existing) {
        throw httpError(409, 'A user with this mobile number already exists.', 'DUPLICATE_RECORD');
      }

      const [user] = await User.create(
        [
          {
            role,
            name: String(name).trim(),
            phone: cleanPhone,
            email: email ? String(email).trim().toLowerCase() : '',
            password: finalPassword,
            walletBalance: 0,
            isPhoneVerified: true,
            accountStatus: 'active',
          },
        ],
        { session: mongoSession }
      );

      await ProfessionalProfile.create(
        [{ user: user._id, professionalRole: role, verificationStatus: 'pending' }],
        { session: mongoSession }
      );

      createdId = user._id;
    });

    const [user, professionalProfile] = await Promise.all([
      User.findById(createdId).select('-password').lean(),
      ProfessionalProfile.findOne({ user: createdId }).lean(),
    ]);

    return res.status(201).json({
      success: true,
      message: 'Staff account created. Profile is pending verification.',
      data: {
        user,
        professionalProfile,
        ...(generated ? { temporaryPassword: finalPassword } : {}),
      },
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

// ---------------------------------------------------------------------------
// Update user (validated)
// ---------------------------------------------------------------------------
const adminUpdateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    assertValidId(userId, 'userId');
    const { name, email, accountStatus, role, assignedRelationshipManager } = req.body;

    const user = await User.findById(userId);
    if (!user) throw httpError(404, 'User not found.');
    if (user.role === 'admin') {
      throw httpError(403, 'Admin accounts cannot be modified here.', 'FORBIDDEN_TARGET');
    }
    if (user.accountStatus === 'deleted') {
      throw httpError(400, 'Deleted accounts cannot be modified.');
    }

    const warnings = [];
    const wasPro = PROFESSIONAL_ROLES.includes(user.role);
    let suspended = false;

    if (name !== undefined) {
      if (String(name).trim().length < 2) throw httpError(400, 'Name must be at least 2 characters.');
      user.name = String(name).trim();
    }

    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (cleanEmail && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        throw httpError(400, 'Please provide a valid email address.');
      }
      user.email = cleanEmail;
    }

    if (accountStatus !== undefined) {
      if (!ASSIGNABLE_STATUSES.includes(accountStatus)) {
        throw httpError(400, `accountStatus must be one of: ${ASSIGNABLE_STATUSES.join(', ')}.`);
      }
      if (accountStatus === 'suspended' && user.accountStatus !== 'suspended') suspended = true;
      user.accountStatus = accountStatus;
      if (accountStatus === 'active') user.isPhoneVerified = true;
    }

    let newRole = user.role;
    if (role !== undefined && role !== user.role) {
      if (!MANAGEABLE_ROLES.includes(role)) {
        throw httpError(400, `role must be one of: ${MANAGEABLE_ROLES.join(', ')}.`);
      }
      if (wasPro) {
        const open = await Session.countDocuments({
          professional: user._id,
          status: { $in: OPEN_SESSION_STATUSES },
        });
        if (open > 0) {
          throw httpError(
            409,
            `This professional has ${open} open session(s). Reassign them before changing the role.`,
            'OPEN_SESSIONS'
          );
        }
      }
      newRole = role;
      user.role = role;
    }

    if (assignedRelationshipManager !== undefined) {
      if (assignedRelationshipManager === null || assignedRelationshipManager === '') {
        user.profile.assignedRelationshipManager = null;
      } else {
        assertValidId(assignedRelationshipManager, 'assignedRelationshipManager');
        const rm = await User.findOne({
          _id: assignedRelationshipManager,
          role: 'relationship_manager',
          accountStatus: 'active',
        })
          .select('_id')
          .lean();
        if (!rm) throw httpError(400, 'Assigned manager must be an active relationship_manager.');
        user.profile.assignedRelationshipManager = rm._id;
      }
    }

    await user.save();

    if (suspended) {
      await revokeRefreshToken(user._id);
      if (wasPro) {
        const open = await Session.countDocuments({
          professional: user._id,
          status: { $in: OPEN_SESSION_STATUSES },
        });
        if (open > 0) {
          warnings.push(`${open} open session(s) are still assigned to this suspended professional.`);
        }
      }
    }

    // Keep the professional profile in step with the role
    const isProNow = PROFESSIONAL_ROLES.includes(newRole);
    if (isProNow) {
      await ProfessionalProfile.findOneAndUpdate(
        { user: user._id },
        {
          $set: { professionalRole: newRole },
          $setOnInsert: { user: user._id, verificationStatus: 'pending' },
        },
        { upsert: true }
      );
    } else if (wasPro) {
      await ProfessionalProfile.updateOne({ user: user._id }, { $set: { isAvailable: false } });
    }

    const [safeUser, professionalProfile] = await Promise.all([
      User.findById(user._id).select('-password').lean(),
      isProNow ? ProfessionalProfile.findOne({ user: user._id }).lean() : null,
    ]);

    return res.status(200).json({
      success: true,
      message: 'User updated by Admin.',
      data: { user: safeUser, professionalProfile, warnings },
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// Password reset (the mobile app sends users to support for this)
// ---------------------------------------------------------------------------
const adminResetPassword = async (req, res, next) => {
  try {
    const { userId } = req.params;
    assertValidId(userId, 'userId');

    const user = await User.findById(userId);
    if (!user) throw httpError(404, 'User not found.');
    if (user.role === 'admin') {
      throw httpError(403, 'Admin passwords cannot be reset here.', 'FORBIDDEN_TARGET');
    }
    if (user.accountStatus === 'deleted') {
      throw httpError(400, 'Cannot reset the password of a deleted account.');
    }

    const supplied = req.body?.newPassword;
    if (supplied !== undefined && String(supplied).length < 6) {
      throw httpError(400, 'Password must be at least 6 characters.');
    }
    const generated = supplied === undefined || supplied === '';
    const finalPassword = generated ? generateTempPassword() : String(supplied);

    user.password = finalPassword;
    await user.save();
    await revokeRefreshToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Password reset. All existing refresh sessions were revoked.',
      data: {
        userId: user._id,
        name: user.name,
        phone: user.phone,
        ...(generated ? { temporaryPassword: finalPassword } : {}),
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getDashboardStats,
  adminListUsers,
  adminGetUser,
  adminCreateStaff,
  adminUpdateUser,
  adminResetPassword,
  PROFESSIONAL_ROLES,
};