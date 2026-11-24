const mongoose = require('mongoose');
const User = require('../models/User');
const ProfessionalProfile = require('../models/ProfessionalProfile');
const Session = require('../models/Session');
const SessionReview = require('../models/SessionReview');

const PROFESSIONAL_ROLES = [
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
];
const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'expired'];
// Roles that cannot be verified without at least one verified, unexpired credential
const CREDENTIAL_REQUIRED_ROLES = ['vet', 'paravet'];
const OPEN_SESSION_STATUSES = ['scheduled', 'professional_arrived', 'in_progress'];
const DAY_MS = 24 * 60 * 60 * 1000;

const httpError = (statusCode, message, code) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assertValidId = (id, label = 'id') => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(400, `Invalid ${label}.`, 'INVALID_ID');
  }
};

const isExpired = (cred, now = new Date()) =>
  Boolean(cred.expiryDate) && new Date(cred.expiryDate).getTime() < now.getTime();

const summarizeCredentials = (credentials = [], now = new Date()) => {
  const soon = now.getTime() + 30 * DAY_MS;
  return {
    total: credentials.length,
    verified: credentials.filter((c) => c.verified).length,
    expired: credentials.filter((c) => isExpired(c, now)).length,
    expiringWithin30Days: credentials.filter(
      (c) =>
        c.expiryDate &&
        !isExpired(c, now) &&
        new Date(c.expiryDate).getTime() <= soon
    ).length,
  };
};

// Accepts a ProfessionalProfile _id or the professional's User _id
const loadProfile = async (idParam) => {
  assertValidId(idParam, 'professional id');
  let profile = await ProfessionalProfile.findById(idParam);
  if (!profile) profile = await ProfessionalProfile.findOne({ user: idParam });
  if (!profile) throw httpError(404, 'Professional profile not found.');
  return profile;
};

const countOpenSessions = (userId) =>
  Session.countDocuments({ professional: userId, status: { $in: OPEN_SESSION_STATUSES } });

// ---------------------------------------------------------------------------
const adminListProfessionals = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};

    if (req.query.status) {
      if (!VERIFICATION_STATUSES.includes(req.query.status)) {
        throw httpError(400, `status must be one of: ${VERIFICATION_STATUSES.join(', ')}.`);
      }
      filter.verificationStatus = req.query.status;
    }
    if (req.query.role) filter.professionalRole = req.query.role;
    if (req.query.isAvailable === 'true') filter.isAvailable = true;
    if (req.query.isAvailable === 'false') filter.isAvailable = false;

    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      const matches = await User.find({
        role: { $in: PROFESSIONAL_ROLES },
        $or: [{ name: rx }, { phone: rx }],
      })
        .select('_id')
        .limit(300)
        .lean();
      filter.user = { $in: matches.map((u) => u._id) };
    }

    const [profiles, total] = await Promise.all([
      ProfessionalProfile.find(filter)
        .populate('user', 'name phone email role accountStatus')
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ProfessionalProfile.countDocuments(filter),
    ]);

    const now = new Date();
    const items = profiles.map((p) => ({
      ...p,
      credentialSummary: summarizeCredentials(p.credentials, now),
    }));

    return res.status(200).json({
      success: true,
      data: {
        professionals: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    return next(err);
  }
};

const adminGetProfessional = async (req, res, next) => {
  try {
    const found = await loadProfile(req.params.profileId);
    const profile = await ProfessionalProfile.findById(found._id)
      .populate('user', 'name phone email role accountStatus walletBalance createdAt')
      .lean();

    const [openSessions, publishedReviews, flaggedReviews, hiddenReviews] = await Promise.all([
      countOpenSessions(found.user),
      SessionReview.countDocuments({ professional: found.user, moderationStatus: 'published' }),
      SessionReview.countDocuments({ professional: found.user, moderationStatus: 'flagged' }),
      SessionReview.countDocuments({ professional: found.user, moderationStatus: 'hidden' }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        professional: { ...profile, credentialSummary: summarizeCredentials(profile.credentials) },
        openSessions,
        reviews: { published: publishedReviews, flagged: flaggedReviews, hidden: hiddenReviews },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Verify / reject / reset / expire a professional
const adminSetVerification = async (req, res, next) => {
  try {
    const { status, notes = '', markAllCredentialsVerified = false } = req.body;
    if (!VERIFICATION_STATUSES.includes(status)) {
      throw httpError(400, `status must be one of: ${VERIFICATION_STATUSES.join(', ')}.`);
    }
    const cleanNotes = String(notes).trim();
    if (status === 'rejected' && !cleanNotes) {
      throw httpError(400, 'Please add notes explaining the rejection.');
    }

    const profile = await loadProfile(req.params.profileId);
    const now = new Date();

    if (status === 'verified') {
      const user = await User.findById(profile.user).select('accountStatus role').lean();
      if (!user || user.accountStatus !== 'active') {
        throw httpError(400, 'The professional account must be active before verification.');
      }
      if (markAllCredentialsVerified) {
        profile.credentials.forEach((c) => {
          if (!isExpired(c, now)) c.verified = true;
        });
      }
      if (
        CREDENTIAL_REQUIRED_ROLES.includes(profile.professionalRole) &&
        !profile.credentials.some((c) => c.verified && !isExpired(c, now))
      ) {
        throw httpError(
          400,
          `A ${profile.professionalRole} needs at least one verified, unexpired credential before verification.`,
          'CREDENTIAL_REQUIRED'
        );
      }
    }

    profile.verificationStatus = status;
    profile.verificationNotes = cleanNotes;
    profile.verifiedAt = status === 'verified' ? now : null;
    await profile.save();

    const warnings = [];
    if (status !== 'verified') {
      const open = await countOpenSessions(profile.user);
      if (open > 0) {
        warnings.push(
          `${open} open session(s) are still assigned to this professional. New bookings will stop being assigned to them.`
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Verification status set to ${status}.`,
      data: {
        professional: profile,
        credentialSummary: summarizeCredentials(profile.credentials, now),
        warnings,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const adminSetCredentialVerified = async (req, res, next) => {
  try {
    const { credentialId } = req.params;
    assertValidId(credentialId, 'credentialId');
    if (typeof req.body.verified !== 'boolean') {
      throw httpError(400, 'verified (true/false) is required.');
    }

    const profile = await loadProfile(req.params.profileId);
    const cred = profile.credentials.id(credentialId);
    if (!cred) throw httpError(404, 'Credential not found.');

    if (req.body.verified && isExpired(cred)) {
      throw httpError(400, 'This credential has expired and cannot be marked verified.');
    }

    cred.verified = req.body.verified;
    await profile.save();

    const warnings = [];
    if (
      !req.body.verified &&
      profile.verificationStatus === 'verified' &&
      CREDENTIAL_REQUIRED_ROLES.includes(profile.professionalRole) &&
      !profile.credentials.some((c) => c.verified && !isExpired(c))
    ) {
      warnings.push(
        'This professional is still marked verified but has no verified credential left. Review their verification status.'
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Credential updated.',
      data: { professional: profile, warnings },
    });
  } catch (err) {
    return next(err);
  }
};

const adminSetAvailability = async (req, res, next) => {
  try {
    if (typeof req.body.isAvailable !== 'boolean') {
      throw httpError(400, 'isAvailable (true/false) is required.');
    }
    const profile = await loadProfile(req.params.profileId);
    profile.isAvailable = req.body.isAvailable;
    await profile.save();
    return res.status(200).json({
      success: true,
      message: `Professional marked ${profile.isAvailable ? 'available' : 'unavailable'}.`,
      data: { professional: profile },
    });
  } catch (err) {
    return next(err);
  }
};

// Credentials expiring within ?days= (default 30), including already expired ones
const adminListExpiringCredentials = async (req, res, next) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const now = new Date();
    const limitDate = new Date(now.getTime() + days * DAY_MS);

    const profiles = await ProfessionalProfile.find({
      credentials: { $elemMatch: { expiryDate: { $ne: null, $lte: limitDate } } },
    })
      .populate('user', 'name phone role accountStatus')
      .lean();

    const rows = [];
    profiles.forEach((p) => {
      (p.credentials || []).forEach((c) => {
        if (c.expiryDate && new Date(c.expiryDate).getTime() <= limitDate.getTime()) {
          rows.push({
            profileId: p._id,
            user: p.user,
            professionalRole: p.professionalRole,
            verificationStatus: p.verificationStatus,
            credentialId: c._id,
            title: c.title,
            issuingBody: c.issuingBody,
            credentialNumber: c.credentialNumber,
            verified: c.verified,
            expiryDate: c.expiryDate,
            expired: isExpired(c, now),
          });
        }
      });
    });
    rows.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    return res.status(200).json({ success: true, data: { days, credentials: rows } });
  } catch (err) {
    return next(err);
  }
};

// Moves verified professionals with an expired, verified credential to "expired".
// Defaults to a dry run so the admin can review the list first.
const adminExpireOverdueProfessionals = async (req, res, next) => {
  try {
    const dryRun = req.body?.dryRun !== false;
    const now = new Date();

    const profiles = await ProfessionalProfile.find({
      verificationStatus: 'verified',
      credentials: { $elemMatch: { verified: true, expiryDate: { $ne: null, $lt: now } } },
    }).populate('user', 'name phone role');

    const affected = profiles.map((p) => ({
      profileId: p._id,
      user: p.user,
      professionalRole: p.professionalRole,
      expiredCredentials: p.credentials
        .filter((c) => c.verified && isExpired(c, now))
        .map((c) => ({ credentialId: c._id, title: c.title, expiryDate: c.expiryDate })),
    }));

    if (!dryRun) {
      for (const p of profiles) {
        p.verificationStatus = 'expired';
        p.verifiedAt = null;
        p.verificationNotes = `Auto-expired on ${now.toISOString().slice(0, 10)}: a verified credential has expired.`;
        // eslint-disable-next-line no-await-in-loop
        await p.save();
      }
    }

    return res.status(200).json({
      success: true,
      message: dryRun
        ? `${affected.length} professional(s) would be expired. Send { "dryRun": false } to apply.`
        : `${affected.length} professional(s) moved to expired.`,
      data: { dryRun, affected },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  adminListProfessionals,
  adminGetProfessional,
  adminSetVerification,
  adminSetCredentialVerified,
  adminSetAvailability,
  adminListExpiringCredentials,
  adminExpireOverdueProfessionals,
};