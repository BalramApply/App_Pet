const mongoose = require('mongoose');
const SessionReview = require('../models/SessionReview');
const ProfessionalProfile = require('../models/ProfessionalProfile');
const Pet = require('../models/Pet');
const VaccinationRecord = require('../models/VaccinationRecord');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const User = require('../models/User');

const REVIEW_STATUSES = ['published', 'flagged', 'hidden'];
const PROFESSIONAL_ROLES = [
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
];
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

const parseDate = (value, label) => {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw httpError(400, `${label} must be a valid date.`);
  return d;
};

// Same rule the app uses when a review is created: average of published reviews only
const recomputeProfessionalRating = async (professionalUserId, mongoSession) => {
  const [agg] = await SessionReview.aggregate([
    {
      $match: {
        professional: new mongoose.Types.ObjectId(professionalUserId),
        moderationStatus: 'published',
      },
    },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]).session(mongoSession || null);

  const count = agg?.count || 0;
  const averageRating = count > 0 ? Number(agg.avg.toFixed(2)) : 0;

  await ProfessionalProfile.findOneAndUpdate(
    { user: professionalUserId },
    { $set: { averageRating, totalEligibleReviews: count } },
    { session: mongoSession || null }
  );
  return { averageRating, totalEligibleReviews: count };
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
const adminListReviews = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};

    if (req.query.moderationStatus) {
      if (!REVIEW_STATUSES.includes(req.query.moderationStatus)) {
        throw httpError(400, `moderationStatus must be one of: ${REVIEW_STATUSES.join(', ')}.`);
      }
      filter.moderationStatus = req.query.moderationStatus;
    }
    if (req.query.professionalId) {
      assertValidId(req.query.professionalId, 'professionalId');
      filter.professional = req.query.professionalId;
    }
    if (req.query.customerId) {
      assertValidId(req.query.customerId, 'customerId');
      filter.customer = req.query.customerId;
    }
    if (req.query.minRating || req.query.maxRating) {
      filter.rating = {};
      if (req.query.minRating) filter.rating.$gte = Number(req.query.minRating);
      if (req.query.maxRating) filter.rating.$lte = Number(req.query.maxRating);
    }
    if (req.query.q) filter.reviewText = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.createdAt.$lte = new Date(req.query.dateTo);
    }

    const [reviews, total] = await Promise.all([
      SessionReview.find(filter)
        .populate('customer', 'name phone')
        .populate('professional', 'name phone role')
        .populate('pet', 'name species')
        .populate('session', 'sessionNumber')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SessionReview.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Publish / flag / hide a review and keep the professional's rating in step
const adminModerateReview = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { reviewId } = req.params;
    assertValidId(reviewId, 'reviewId');
    const { status } = req.body;
    if (!REVIEW_STATUSES.includes(status)) {
      throw httpError(400, `status must be one of: ${REVIEW_STATUSES.join(', ')}.`);
    }

    let result = null;

    await mongoSession.withTransaction(async () => {
      const review = await SessionReview.findById(reviewId).session(mongoSession);
      if (!review) throw httpError(404, 'Review not found.');

      const previous = review.moderationStatus;
      review.moderationStatus = status;
      if (status === 'flagged' && !review.reportedAt) review.reportedAt = new Date();
      await review.save({ session: mongoSession });

      const rating = await recomputeProfessionalRating(review.professional, mongoSession);
      result = { reviewId: review._id, previousStatus: previous, newStatus: status, rating };
    });

    return res.status(200).json({
      success: true,
      message: `Review ${status}. Professional rating recalculated.`,
      data: result,
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

// Rebuild ratings from published reviews: one professional (professionalId) or everyone
const adminRecalculateRatings = async (req, res, next) => {
  try {
    const { professionalId } = req.body || {};
    let ids;
    if (professionalId) {
      assertValidId(professionalId, 'professionalId');
      ids = [professionalId];
    } else {
      ids = (await SessionReview.distinct('professional')).map((id) => id.toString());
    }

    const updated = [];
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      const rating = await recomputeProfessionalRating(id);
      updated.push({ professionalId: id, ...rating });
    }

    return res.status(200).json({
      success: true,
      message: `Ratings recalculated for ${updated.length} professional(s).`,
      data: { updated },
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// Pets
// ---------------------------------------------------------------------------
const adminListPets = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};

    if (req.query.userId) {
      assertValidId(req.query.userId, 'userId');
      filter.user = req.query.userId;
    }
    if (['dog', 'cat'].includes(req.query.species)) filter.species = req.query.species;
    if (req.query.active === 'false') filter.isActive = false;
    else if (req.query.active !== 'all') filter.isActive = true;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      filter.$or = [{ name: rx }, { breed: rx }];
    }

    const [pets, total] = await Promise.all([
      Pet.find(filter)
        .populate('user', 'name phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Pet.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: { pets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    return next(err);
  }
};

const adminGetPet = async (req, res, next) => {
  try {
    const { petId } = req.params;
    assertValidId(petId, 'petId');

    const pet = await Pet.findById(petId).populate('user', 'name phone email').lean();
    if (!pet) throw httpError(404, 'Pet not found.');

    const [bookings, completedSessions, vaccinations] = await Promise.all([
      Booking.countDocuments({ pet: pet._id }),
      Session.countDocuments({ pet: pet._id, status: 'completed' }),
      VaccinationRecord.find({ pet: pet._id }).sort({ administeredDate: -1 }).limit(20).lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: { pet, counts: { bookings, completedSessions }, vaccinations },
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// Vaccinations
// ---------------------------------------------------------------------------
// due=overdue -> booster date passed; due=upcoming (default days=30) -> booster due soon
const adminListVaccinations = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};
    const now = new Date();

    if (req.query.petId) {
      assertValidId(req.query.petId, 'petId');
      filter.pet = req.query.petId;
    }
    if (req.query.customerId) {
      assertValidId(req.query.customerId, 'customerId');
      filter.customer = req.query.customerId;
    }
    if (req.query.q) filter.vaccineName = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
    if (req.query.missingCertificate === 'true') filter.certificateUrl = '';

    if (req.query.due === 'overdue') {
      filter.nextDueDate = { $ne: null, $lt: now };
    } else if (req.query.due === 'upcoming') {
      const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
      filter.nextDueDate = { $gte: now, $lte: new Date(now.getTime() + days * DAY_MS) };
    }

    const sort = req.query.due ? { nextDueDate: 1 } : { administeredDate: -1 };

    const [records, total] = await Promise.all([
      VaccinationRecord.find(filter)
        .populate('pet', 'name species breed')
        .populate('customer', 'name phone')
        .populate('administeredBy', 'name role')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VaccinationRecord.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: { records, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    return next(err);
  }
};

const validateVaccinationFields = async (b, { requireCore }) => {
  const out = {};

  if (requireCore || b.vaccineName !== undefined) {
    const name = String(b.vaccineName || '').trim();
    if (!name) throw httpError(400, 'vaccineName is required.');
    out.vaccineName = name;
  }
  if (requireCore || b.doseNumber !== undefined) {
    const dose = Number(b.doseNumber === undefined ? 1 : b.doseNumber);
    if (!Number.isInteger(dose) || dose < 1) throw httpError(400, 'doseNumber must be a whole number >= 1.');
    out.doseNumber = dose;
  }
  if (requireCore || b.administeredDate !== undefined) {
    const d = parseDate(b.administeredDate, 'administeredDate');
    if (d.getTime() > Date.now() + DAY_MS) throw httpError(400, 'administeredDate cannot be in the future.');
    out.administeredDate = d;
  }
  if (b.nextDueDate !== undefined) {
    out.nextDueDate = b.nextDueDate === null || b.nextDueDate === '' ? null : parseDate(b.nextDueDate, 'nextDueDate');
  }
  if (b.vaccineCode !== undefined) out.vaccineCode = String(b.vaccineCode).trim();
  if (b.batchNumber !== undefined) out.batchNumber = String(b.batchNumber).trim();
  if (b.clinicOrHomeNotes !== undefined) {
    const notes = String(b.clinicOrHomeNotes).trim();
    if (notes.length > 1000) throw httpError(400, 'clinicOrHomeNotes must be 1000 characters or fewer.');
    out.clinicOrHomeNotes = notes;
  }
  if (b.certificateUrl !== undefined) {
    const url = String(b.certificateUrl).trim();
    if (url && !/^https?:\/\//i.test(url)) throw httpError(400, 'certificateUrl must start with http:// or https://.');
    out.certificateUrl = url;
  }
  if (b.reminderSent !== undefined) out.reminderSent = Boolean(b.reminderSent);

  if (b.administeredBy !== undefined) {
    if (b.administeredBy === null || b.administeredBy === '') {
      out.administeredBy = null;
    } else {
      assertValidId(b.administeredBy, 'administeredBy');
      const pro = await User.findOne({ _id: b.administeredBy, role: { $in: PROFESSIONAL_ROLES } })
        .select('_id')
        .lean();
      if (!pro) throw httpError(400, 'administeredBy must be a professional account.');
      out.administeredBy = pro._id;
    }
  }
  return out;
};

const adminCreateVaccination = async (req, res, next) => {
  try {
    const { petId, bookingId, sessionId } = req.body;
    if (!petId) throw httpError(400, 'petId is required.');
    assertValidId(petId, 'petId');

    const pet = await Pet.findById(petId).select('user isActive').lean();
    if (!pet) throw httpError(404, 'Pet not found.');

    const fields = await validateVaccinationFields(req.body, { requireCore: true });
    if (fields.nextDueDate && fields.nextDueDate <= fields.administeredDate) {
      throw httpError(400, 'nextDueDate must be after administeredDate.');
    }

    let booking = null;
    let session = null;
    if (bookingId) {
      assertValidId(bookingId, 'bookingId');
      booking = bookingId;
    }
    if (sessionId) {
      assertValidId(sessionId, 'sessionId');
      session = sessionId;
    }

    const record = await VaccinationRecord.create({
      ...fields,
      pet: pet._id,
      customer: pet.user,
      booking,
      session,
    });

    return res.status(201).json({ success: true, data: { record } });
  } catch (err) {
    return next(err);
  }
};

// Mainly used to attach certificates, fix batch numbers and move booster dates
const adminUpdateVaccination = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    assertValidId(recordId, 'recordId');

    const record = await VaccinationRecord.findById(recordId);
    if (!record) throw httpError(404, 'Vaccination record not found.');

    const fields = await validateVaccinationFields(req.body, { requireCore: false });
    if (Object.keys(fields).length === 0) throw httpError(400, 'No updatable fields provided.');

    record.set(fields);
    if (record.nextDueDate && record.nextDueDate <= record.administeredDate) {
      throw httpError(400, 'nextDueDate must be after administeredDate.');
    }
    // A moved booster date should be reminded again
    if (fields.nextDueDate !== undefined && req.body.reminderSent === undefined) {
      record.reminderSent = false;
    }
    await record.save();

    return res.status(200).json({ success: true, message: 'Vaccination record updated.', data: { record } });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  adminListReviews,
  adminModerateReview,
  adminRecalculateRatings,
  adminListPets,
  adminGetPet,
  adminListVaccinations,
  adminCreateVaccination,
  adminUpdateVaccination,
};