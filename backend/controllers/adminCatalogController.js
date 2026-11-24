const mongoose = require('mongoose');
const Service = require('../models/Service');
const Package = require('../models/Package');
const Booking = require('../models/Booking');
const AppConfig = require('../models/AppConfig');

const SERVICE_TYPES = ['Training', 'Walking', 'Grooming', 'Vaccination'];
const SPECIES = ['dog', 'cat'];
const LIFE_STAGES = ['all', 'puppy_kitten', 'adult', 'senior'];

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

const isBlank = (v) => v === undefined || v === null || v === '';

const toStringArray = (value, label) => {
  if (!Array.isArray(value)) throw httpError(400, `${label} must be an array.`);
  return value.map((s) => String(s).trim()).filter(Boolean);
};

const toSpecies = (value, label = 'species') => {
  const arr = [...new Set(toStringArray(value, label))];
  if (arr.length === 0 || arr.some((s) => !SPECIES.includes(s))) {
    throw httpError(400, `${label} must be a non-empty list from: ${SPECIES.join(', ')}.`);
  }
  return arr;
};

const toNumber = (value, label, { min, max, integer = false } = {}) => {
  const n = Number(value);
  const bad =
    isBlank(value) ||
    !Number.isFinite(n) ||
    (min !== undefined && n < min) ||
    (max !== undefined && n > max) ||
    (integer && !Number.isInteger(n));
  if (bad) {
    const range = [min !== undefined ? `>= ${min}` : '', max !== undefined ? `<= ${max}` : '']
      .filter(Boolean)
      .join(' and ');
    throw httpError(400, `${label} must be ${integer ? 'a whole number' : 'a number'}${range ? ` ${range}` : ''}.`);
  }
  return n;
};

const getDefaultPayoutPercentage = async () => {
  const cfg = await AppConfig.findOne({ configKey: 'GLOBAL_CONFIG' })
    .select('operationalRules.defaultTrainerPayoutPercentage')
    .lean();
  const pct = Number(cfg?.operationalRules?.defaultTrainerPayoutPercentage);
  return Number.isFinite(pct) && pct > 0 ? pct : 75;
};

/**
 * Validates and normalises a complete package definition against its service.
 * Used for both create and update (update merges the stored doc with the changes first).
 */
const normalizePackage = (input, serviceDoc, defaultPayoutPct = 75) => {
  const name = String(input.name || '').trim();
  if (!name) throw httpError(400, 'name is required.');

  const species = toSpecies(isBlank(input.species) ? serviceDoc.targetSpecies : input.species);
  const unsupported = species.filter((s) => !serviceDoc.targetSpecies.includes(s));
  if (unsupported.length > 0) {
    throw httpError(
      400,
      `Service "${serviceDoc.title}" does not support: ${unsupported.join(', ')}.`
    );
  }

  const sessionCount = toNumber(input.sessionCount, 'sessionCount', { min: 1, max: 120, integer: true });
  const sessionDuration = isBlank(input.sessionDuration)
    ? Number(serviceDoc.sessionDuration)
    : toNumber(input.sessionDuration, 'sessionDuration', { min: 10, max: 240, integer: true });
  const price = toNumber(input.price, 'price', { min: 0 });

  const freeDemoEligible = Boolean(input.freeDemoEligible);
  if (freeDemoEligible && (price !== 0 || sessionCount !== 1)) {
    throw httpError(400, 'A free demo/assessment package must have price 0 and exactly 1 session.');
  }

  const perSessionPrice = price / sessionCount;
  const payout = isBlank(input.trainerPayoutPerSession)
    ? Math.round((perSessionPrice * defaultPayoutPct) / 100)
    : toNumber(input.trainerPayoutPerSession, 'trainerPayoutPerSession', { min: 0 });

  // Free packages may pay the professional (platform cost); paid ones must not lose money
  if (price > 0 && payout > perSessionPrice) {
    throw httpError(
      400,
      `Professional payout (INR ${payout}) cannot exceed the per-session price (INR ${perSessionPrice.toFixed(2)}).`,
      'PAYOUT_EXCEEDS_PRICE'
    );
  }

  const lifeStage = isBlank(input.lifeStage) ? 'all' : String(input.lifeStage);
  if (!LIFE_STAGES.includes(lifeStage)) {
    throw httpError(400, `lifeStage must be one of: ${LIFE_STAGES.join(', ')}.`);
  }

  const normalized = {
    name,
    categoryTag: isBlank(input.categoryTag) ? 'General' : String(input.categoryTag).trim(),
    species,
    lifeStage,
    sessionCount,
    sessionDuration,
    price,
    trainerPayoutPerSession: payout,
    freeDemoEligible,
    inclusions: isBlank(input.inclusions) ? [] : toStringArray(input.inclusions, 'inclusions'),
    activeStatus: input.activeStatus === undefined ? true : Boolean(input.activeStatus),
  };

  if (input.vaccineDetails && typeof input.vaccineDetails === 'object') {
    const v = input.vaccineDetails;
    normalized.vaccineDetails = {
      vaccineName: String(v.vaccineName || '').trim(),
      doseCount: isBlank(v.doseCount) ? 1 : toNumber(v.doseCount, 'doseCount', { min: 1, integer: true }),
      boosterIntervalDays: isBlank(v.boosterIntervalDays)
        ? 365
        : toNumber(v.boosterIntervalDays, 'boosterIntervalDays', { min: 1, integer: true }),
    };
    if (serviceDoc.type === 'Vaccination' && !normalized.vaccineDetails.vaccineName) {
      throw httpError(400, 'vaccineDetails.vaccineName is required for vaccination packages.');
    }
  }

  return normalized;
};

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
const adminListServices = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.activeStatus === 'true') filter.activeStatus = true;
    if (req.query.activeStatus === 'false') filter.activeStatus = false;

    const [services, counts] = await Promise.all([
      Service.find(filter).sort({ type: 1, createdAt: 1 }).lean(),
      Package.aggregate([
        {
          $group: {
            _id: '$service',
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$activeStatus', 1, 0] } },
          },
        },
      ]),
    ]);

    const countMap = new Map(counts.map((c) => [c._id.toString(), c]));
    const items = services.map((s) => ({
      ...s,
      packageCounts: {
        total: countMap.get(s._id.toString())?.total || 0,
        active: countMap.get(s._id.toString())?.active || 0,
      },
    }));

    return res.status(200).json({ success: true, data: { services: items } });
  } catch (err) {
    return next(err);
  }
};

const adminCreateService = async (req, res, next) => {
  try {
    const b = req.body;
    if (!SERVICE_TYPES.includes(b.type)) {
      throw httpError(400, `type must be one of: ${SERVICE_TYPES.join(', ')}.`);
    }
    const code = String(b.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_]{3,30}$/.test(code)) {
      throw httpError(400, 'code must be 3-30 characters: A-Z, 0-9 and underscore (e.g. TRN_ADV).');
    }
    const title = String(b.title || '').trim();
    const description = String(b.description || '').trim();
    if (!title) throw httpError(400, 'title is required.');
    if (!description) throw httpError(400, 'description is required.');

    if (await Service.exists({ code })) {
      throw httpError(409, `A service with code ${code} already exists.`, 'DUPLICATE_RECORD');
    }

    const service = await Service.create({
      type: b.type,
      code,
      title,
      description,
      targetSpecies: toSpecies(b.targetSpecies, 'targetSpecies'),
      syllabusOrInclusions: isBlank(b.syllabusOrInclusions) ? [] : toStringArray(b.syllabusOrInclusions, 'syllabusOrInclusions'),
      features: isBlank(b.features) ? [] : toStringArray(b.features, 'features'),
      sessionDuration: toNumber(b.sessionDuration, 'sessionDuration', { min: 10, max: 240, integer: true }),
      activeStatus: b.activeStatus === undefined ? true : Boolean(b.activeStatus),
    });

    return res.status(201).json({ success: true, data: { service } });
  } catch (err) {
    return next(err);
  }
};

// type and code are immutable: roles are mapped from type and code identifies the service
const adminUpdateService = async (req, res, next) => {
  try {
    const { serviceId } = req.params;
    assertValidId(serviceId, 'serviceId');
    const b = req.body;

    if (b.type !== undefined || b.code !== undefined) {
      throw httpError(400, 'type and code cannot be changed. Create a new service instead.');
    }

    const service = await Service.findById(serviceId);
    if (!service) throw httpError(404, 'Service not found.');

    if (b.title !== undefined) {
      if (!String(b.title).trim()) throw httpError(400, 'title cannot be empty.');
      service.title = String(b.title).trim();
    }
    if (b.description !== undefined) {
      if (!String(b.description).trim()) throw httpError(400, 'description cannot be empty.');
      service.description = String(b.description).trim();
    }
    if (b.targetSpecies !== undefined) {
      const species = toSpecies(b.targetSpecies, 'targetSpecies');
      const conflicting = await Package.countDocuments({
        service: service._id,
        species: { $elemMatch: { $nin: species } },
      });
      if (conflicting > 0) {
        throw httpError(
          409,
          `${conflicting} package(s) of this service use species outside ${species.join(', ')}. Update those packages first.`,
          'SPECIES_CONFLICT'
        );
      }
      service.targetSpecies = species;
    }
    if (b.syllabusOrInclusions !== undefined) {
      service.syllabusOrInclusions = toStringArray(b.syllabusOrInclusions, 'syllabusOrInclusions');
    }
    if (b.features !== undefined) service.features = toStringArray(b.features, 'features');
    if (b.sessionDuration !== undefined) {
      service.sessionDuration = toNumber(b.sessionDuration, 'sessionDuration', { min: 10, max: 240, integer: true });
    }
    if (b.activeStatus !== undefined) service.activeStatus = Boolean(b.activeStatus);

    await service.save();
    return res.status(200).json({ success: true, message: 'Service updated.', data: { service } });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// Packages
// ---------------------------------------------------------------------------
const adminListPackages = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.serviceId) {
      assertValidId(req.query.serviceId, 'serviceId');
      filter.service = req.query.serviceId;
    }
    if (req.query.species && SPECIES.includes(req.query.species)) filter.species = req.query.species;
    if (req.query.activeStatus === 'true') filter.activeStatus = true;
    if (req.query.activeStatus === 'false') filter.activeStatus = false;
    if (req.query.q) filter.name = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');

    const packages = await Package.find(filter)
      .populate('service', 'type code title activeStatus')
      .sort({ service: 1, price: 1 })
      .lean();

    return res.status(200).json({ success: true, data: { packages } });
  } catch (err) {
    return next(err);
  }
};

const adminCreatePackage = async (req, res, next) => {
  try {
    const rawService = req.body.service || req.body.serviceId;
    if (!rawService) throw httpError(400, 'service (id) is required.');
    assertValidId(rawService, 'service');

    const serviceDoc = await Service.findById(rawService).lean();
    if (!serviceDoc) throw httpError(404, 'Service not found.');

    const pct = await getDefaultPayoutPercentage();
    const data = normalizePackage(req.body, serviceDoc, pct);

    if (await Package.exists({ service: serviceDoc._id, name: data.name })) {
      throw httpError(409, 'This service already has a package with that name.', 'DUPLICATE_RECORD');
    }

    const pkg = await Package.create({ service: serviceDoc._id, ...data });
    return res.status(201).json({ success: true, data: { package: pkg } });
  } catch (err) {
    return next(err);
  }
};

const PACKAGE_EDITABLE_FIELDS = [
  'name',
  'categoryTag',
  'species',
  'lifeStage',
  'sessionCount',
  'sessionDuration',
  'price',
  'trainerPayoutPerSession',
  'freeDemoEligible',
  'inclusions',
  'vaccineDetails',
  'activeStatus',
];

const adminUpdatePackage = async (req, res, next) => {
  try {
    const { packageId } = req.params;
    assertValidId(packageId, 'packageId');

    if (req.body.service !== undefined || req.body.serviceId !== undefined) {
      throw httpError(400, 'A package cannot be moved to another service.');
    }

    const pkg = await Package.findById(packageId);
    if (!pkg) throw httpError(404, 'Package not found.');
    const serviceDoc = await Service.findById(pkg.service).lean();
    if (!serviceDoc) throw httpError(404, 'Parent service not found.');

    const merged = pkg.toObject();
    PACKAGE_EDITABLE_FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) merged[f] = req.body[f];
    });

    const pct = await getDefaultPayoutPercentage();
    const data = normalizePackage(merged, serviceDoc, pct);

    if (data.name !== pkg.name) {
      const clash = await Package.exists({
        service: pkg.service,
        name: data.name,
        _id: { $ne: pkg._id },
      });
      if (clash) throw httpError(409, 'This service already has a package with that name.', 'DUPLICATE_RECORD');
    }

    const pricingChanged =
      data.price !== pkg.price ||
      data.sessionCount !== pkg.sessionCount ||
      data.trainerPayoutPerSession !== pkg.trainerPayoutPerSession;

    pkg.set(data);
    await pkg.save();

    let activeBookings = 0;
    if (pricingChanged) {
      activeBookings = await Booking.countDocuments({
        package: pkg._id,
        status: { $in: ['upcoming', 'active'] },
      });
    }

    return res.status(200).json({
      success: true,
      message: pricingChanged
        ? `Package updated. ${activeBookings} existing upcoming/active booking(s) keep their original price and payout.`
        : 'Package updated.',
      data: { package: pkg, unaffectedExistingBookings: activeBookings },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  adminListServices,
  adminCreateService,
  adminUpdateService,
  adminListPackages,
  adminCreatePackage,
  adminUpdatePackage,
  normalizePackage,
};