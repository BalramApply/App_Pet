const mongoose = require('mongoose');
const AppConfig = require('../models/AppConfig');
const AdminAuditLog = require('../models/AdminAuditLog');

const SUPPORT_KEYS = ['supportPhone', 'supportWhatsApp', 'supportEmail', 'supportHours', 'emergencyHelpline'];
const POLICY_KEYS = ['cancellationPolicy', 'walletPolicy', 'privacyPolicy'];
// key -> [min, max, mustBeInteger]
const RULE_LIMITS = {
  registrationCodeExpiryMinutes: [1, 60, true],
  cancellationFreeWindowHours: [0, 168, false],
  cancellationFeePercentage: [0, 100, false],
  defaultTrainerPayoutPercentage: [1, 100, false],
};
const DEFAULT_RULES = {
  registrationCodeExpiryMinutes: 10,
  cancellationFreeWindowHours: 6,
  cancellationFeePercentage: 20,
  defaultTrainerPayoutPercentage: 75,
};
const MAX_POLICY_LENGTH = 20000;

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

const adminGetSettings = async (req, res, next) => {
  try {
    const config = await AppConfig.findOne({ configKey: 'GLOBAL_CONFIG' })
      .populate('updatedBy', 'name')
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        config: config || {
          configKey: 'GLOBAL_CONFIG',
          supportContact: null,
          operationalRules: DEFAULT_RULES,
          policyDocuments: { cancellationPolicy: '', walletPolicy: '', privacyPolicy: '' },
        },
        isStored: Boolean(config),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Partial, field-level update. Unlike a whole-object replace, sending one support
// field never wipes the others.
const adminUpdateSettings = async (req, res, next) => {
  try {
    const { supportContact, operationalRules, policyDocuments } = req.body;
    if (!supportContact && !operationalRules && !policyDocuments) {
      throw httpError(400, 'Provide supportContact, operationalRules and/or policyDocuments.');
    }

    const existing = await AppConfig.findOne({ configKey: 'GLOBAL_CONFIG' }).select('_id').lean();
    const set = { updatedBy: req.user._id };

    if (supportContact) {
      const unknown = Object.keys(supportContact).filter((k) => !SUPPORT_KEYS.includes(k));
      if (unknown.length > 0) throw httpError(400, `Unknown supportContact field(s): ${unknown.join(', ')}.`);

      SUPPORT_KEYS.forEach((key) => {
        if (supportContact[key] === undefined) return;
        const value = String(supportContact[key]).trim();
        if (!value) throw httpError(400, `${key} cannot be empty.`);
        if (key === 'supportEmail' && !/^\S+@\S+\.\S+$/.test(value)) {
          throw httpError(400, 'supportEmail must be a valid email address.');
        }
        if (['supportPhone', 'supportWhatsApp', 'emergencyHelpline'].includes(key) && !/^[+0-9][0-9\s-]{6,}$/.test(value)) {
          throw httpError(400, `${key} must look like a phone number.`);
        }
        set[`supportContact.${key}`] = value;
      });

      if (!existing) {
        const missing = SUPPORT_KEYS.filter((k) => supportContact[k] === undefined);
        if (missing.length > 0) {
          throw httpError(400, `No settings exist yet, so supportContact needs all fields. Missing: ${missing.join(', ')}.`);
        }
      }
    }

    if (operationalRules) {
      const unknown = Object.keys(operationalRules).filter((k) => !RULE_LIMITS[k]);
      if (unknown.length > 0) throw httpError(400, `Unknown operationalRules field(s): ${unknown.join(', ')}.`);

      Object.entries(operationalRules).forEach(([key, raw]) => {
        const [min, max, integer] = RULE_LIMITS[key];
        const n = Number(raw);
        if (raw === '' || raw === null || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
          throw httpError(400, `${key} must be ${integer ? 'a whole number' : 'a number'} from ${min} to ${max}.`);
        }
        set[`operationalRules.${key}`] = n;
      });
    }

    if (policyDocuments) {
      const unknown = Object.keys(policyDocuments).filter((k) => !POLICY_KEYS.includes(k));
      if (unknown.length > 0) throw httpError(400, `Unknown policyDocuments field(s): ${unknown.join(', ')}.`);

      Object.entries(policyDocuments).forEach(([key, raw]) => {
        const value = String(raw ?? '');
        if (value.length > MAX_POLICY_LENGTH) {
          throw httpError(400, `${key} must be ${MAX_POLICY_LENGTH} characters or fewer.`);
        }
        set[`policyDocuments.${key}`] = value;
      });
    }

    const config = await AppConfig.findOneAndUpdate(
      { configKey: 'GLOBAL_CONFIG' },
      { $set: set, $setOnInsert: { configKey: 'GLOBAL_CONFIG' } },
      { upsert: true, returnDocument: 'after' }
    ).lean();

    return res.status(200).json({ success: true, message: 'Settings updated.', data: { config } });
  } catch (err) {
    return next(err);
  }
};

// Every admin write, newest first
const adminListAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const filter = {};

    if (req.query.actorId) {
      assertValidId(req.query.actorId, 'actorId');
      filter.actor = req.query.actorId;
    }
    if (req.query.method) filter.method = String(req.query.method).toUpperCase();
    if (req.query.success === 'true') filter.success = true;
    if (req.query.success === 'false') filter.success = false;
    if (req.query.targetId) filter.targetId = String(req.query.targetId);
    if (req.query.q) filter.action = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo);
    }

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(filter)
        .populate('actor', 'name role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminAuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: { logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { adminGetSettings, adminUpdateSettings, adminListAuditLogs };