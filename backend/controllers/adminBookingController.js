const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const Service = require('../models/Service');
const Package = require('../models/Package');
const User = require('../models/User');
const ProfessionalProfile = require('../models/ProfessionalProfile');
const WalletTransaction = require('../models/WalletTransaction');
const SessionAuditLog = require('../models/SessionAuditLog');
const { settleCompletedSession } = require('../utils/walletSettlement');
const { getIO } = require('../sockets/socketServer');

const PROFESSIONAL_ROLES = [
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
];
// Which professional roles may serve which service type
const SERVICE_PRO_ROLES = {
  Training: ['trainer'],
  Walking: ['walker'],
  Grooming: ['groomer'],
  Vaccination: ['vet', 'paravet'],
};
const OPEN_SESSION_STATUSES = ['scheduled', 'professional_arrived', 'in_progress'];
const FINAL_SESSION_STATUSES = ['completed', 'cancelled'];
const BOOKING_STATUSES = ['upcoming', 'active', 'completed', 'cancelled'];
const SESSION_STATUSES = [
  'scheduled',
  'professional_arrived',
  'in_progress',
  'duration_completed',
  'completed',
  'interrupted',
  'disputed',
  'cancelled',
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

const parseFutureDate = (value, label = 'scheduledDate') => {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw httpError(400, `${label} must be a valid date.`);
  if (d.getTime() <= Date.now()) throw httpError(400, `${label} must be in the future.`);
  return d;
};

const emitSessionEvent = (sessionId, eventName, payload) => {
  try {
    const io = getIO();
    if (io) io.to(`session:${sessionId.toString()}`).emit(eventName, payload);
  } catch (e) {
    // Socket delivery is best-effort
  }
};

const logSessionEvent = (mongoSession, { session, booking, admin, action, previousStatus, newStatus, metadata }) =>
  SessionAuditLog.create(
    [
      {
        session: session._id || session,
        booking: booking._id || booking,
        actor: admin._id,
        actorRole: 'admin',
        action,
        previousStatus: previousStatus || null,
        newStatus: newStatus || null,
        timestamp: new Date(),
        metadata: metadata || {},
      },
    ],
    { session: mongoSession }
  );

const appendNote = (previous, label, text) => {
  const entry = `[${label}]: ${text}`;
  const out = previous ? `${previous} | ${entry}` : entry;
  return out.length > 2000 ? out.slice(out.length - 2000) : out;
};

// A professional must be active, hold a role valid for the service, and be verified
const loadAssignableProfessional = async (userId, serviceType, mongoSession) => {
  assertValidId(userId, 'professionalId');
  const user = await User.findById(userId).session(mongoSession || null);
  if (!user || user.accountStatus !== 'active') {
    throw httpError(400, 'The selected professional is not an active account.');
  }
  const allowed = SERVICE_PRO_ROLES[serviceType] || [];
  if (!allowed.includes(user.role)) {
    throw httpError(
      400,
      `A ${serviceType} booking needs a ${allowed.join(' or ')}; the selected user is a ${user.role}.`,
      'ROLE_MISMATCH'
    );
  }
  const profile = await ProfessionalProfile.findOne({
    user: user._id,
    verificationStatus: 'verified',
  })
    .select('_id')
    .session(mongoSession || null)
    .lean();
  if (!profile) throw httpError(400, 'The selected professional is not verified.', 'NOT_VERIFIED');
  return user;
};

// Re-derives booking counters/status from its sessions
const recomputeBookingState = async (booking, mongoSession) => {
  const sessions = await Session.find({ booking: booking._id }).select('status').session(mongoSession);
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const open = sessions.filter((s) => !FINAL_SESSION_STATUSES.includes(s.status)).length;
  const live = sessions.some((s) => s.status === 'in_progress');

  booking.completedSessionCount = completed;
  booking.reviewEligibility = completed > 0;

  if (completed >= booking.totalSessionCount) {
    booking.status = 'completed';
    booking.serviceCompletionStatus = 'completed';
  } else if (open === 0) {
    booking.status = completed > 0 ? 'completed' : 'cancelled';
    booking.serviceCompletionStatus = completed > 0 ? 'partial' : 'not_started';
  } else {
    booking.serviceCompletionStatus = completed > 0 ? 'partial' : live ? 'in_progress' : 'not_started';
  }
  await booking.save({ session: mongoSession });
  return booking;
};

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
const adminListBookings = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};

    if (req.query.status) {
      if (!BOOKING_STATUSES.includes(req.query.status)) {
        throw httpError(400, `status must be one of: ${BOOKING_STATUSES.join(', ')}.`);
      }
      filter.status = req.query.status;
    }
    if (req.query.bookingType) filter.bookingType = req.query.bookingType;
    if (req.query.serviceId) {
      assertValidId(req.query.serviceId, 'serviceId');
      filter.service = req.query.serviceId;
    }
    if (req.query.userId) {
      assertValidId(req.query.userId, 'userId');
      filter.user = req.query.userId;
    }
    if (req.query.professionalId) {
      assertValidId(req.query.professionalId, 'professionalId');
      filter.assignedProfessional = req.query.professionalId;
    }
    if (req.query.dateFrom || req.query.dateTo) {
      filter.scheduledDate = {};
      if (req.query.dateFrom) filter.scheduledDate.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.scheduledDate.$lte = new Date(req.query.dateTo);
    }
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
      const matches = await User.find({ $or: [{ name: rx }, { phone: rx }] })
        .select('_id')
        .limit(300)
        .lean();
      filter.user = { $in: matches.map((u) => u._id) };
    }

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('user', 'name phone')
        .populate('pet', 'name species breed')
        .populate('service', 'type title')
        .populate('package', 'name price sessionCount')
        .populate('assignedProfessional', 'name phone role accountStatus')
        .populate('assignedCounsellor', 'name phone')
        .populate({ path: 'sessionIds', select: 'sessionNumber status scheduledDate walletSettled' })
        .sort({ scheduledDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        bookings,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    return next(err);
  }
};

const adminGetBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertValidId(id, 'booking id');

    const booking = await Booking.findById(id)
      .populate('user', 'name phone email walletBalance')
      .populate('pet', 'name species breed age gender medicalHistory behaviourSummary')
      .populate('service', 'type code title sessionDuration')
      .populate('package', 'name sessionCount sessionDuration price trainerPayoutPerSession')
      .populate('assignedProfessional', 'name phone role accountStatus')
      .populate('assignedCounsellor', 'name phone')
      .populate({
        path: 'sessionIds',
        options: { sort: { sessionNumber: 1 } },
        populate: { path: 'professional', select: 'name phone role' },
      })
      .lean();
    if (!booking) throw httpError(404, 'Booking not found.');

    // The route array can be large; the booking view only needs a summary
    booking.sessionIds = (booking.sessionIds || []).map(({ coordinates, ...rest }) => ({
      ...rest,
      routePoints: Array.isArray(coordinates) ? coordinates.length : 0,
    }));

    const [transactions, auditLogs] = await Promise.all([
      WalletTransaction.find({ booking: booking._id }).sort({ createdAt: -1 }).lean(),
      SessionAuditLog.find({ booking: booking._id })
        .populate('actor', 'name role')
        .sort({ timestamp: -1 })
        .limit(200)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: { booking, transactions, auditLogs },
    });
  } catch (err) {
    return next(err);
  }
};

// Change the professional (and optionally the counsellor) on a booking
const adminReassignBooking = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { id } = req.params;
    assertValidId(id, 'booking id');
    const { professionalId, counsellorId, reason = '' } = req.body;
    if (!professionalId && counsellorId === undefined) {
      throw httpError(400, 'Provide professionalId and/or counsellorId.');
    }

    let result = null;

    await mongoSession.withTransaction(async () => {
      const booking = await Booking.findById(id).session(mongoSession);
      if (!booking) throw httpError(404, 'Booking not found.');
      if (['completed', 'cancelled'].includes(booking.status)) {
        throw httpError(400, `A ${booking.status} booking cannot be reassigned.`);
      }
      const service = await Service.findById(booking.service).select('type title').session(mongoSession);
      if (!service) throw httpError(404, 'Service not found for this booking.');

      const live = await Session.countDocuments({ booking: booking._id, status: 'in_progress' }).session(
        mongoSession
      );
      if (professionalId && live > 0) {
        throw httpError(409, 'A session is in progress. Reassign after it ends.', 'SESSION_IN_PROGRESS');
      }

      const changes = {};
      let movedSessions = 0;

      if (professionalId) {
        const newPro = await loadAssignableProfessional(professionalId, service.type, mongoSession);
        const oldProId = booking.assignedProfessional ? booking.assignedProfessional.toString() : null;
        if (oldProId === newPro._id.toString()) {
          throw httpError(400, 'This professional is already assigned to the booking.');
        }

        const movable = await Session.find({
          booking: booking._id,
          status: { $in: ['scheduled', 'professional_arrived'] },
        }).session(mongoSession);

        for (const s of movable) {
          const prev = s.status;
          s.professional = newPro._id;
          // An arrival verified for the old professional does not carry over
          s.status = 'scheduled';
          s.arrivalAt = null;
          s.arrivalVerificationStatus = 'pending';
          await s.save({ session: mongoSession });
          await logSessionEvent(mongoSession, {
            session: s,
            booking,
            admin: req.user,
            action: 'PROFESSIONAL_REASSIGNED',
            previousStatus: prev,
            newStatus: s.status,
            metadata: { from: oldProId, to: newPro._id, reason },
          });
          movedSessions += 1;
        }

        booking.assignedProfessional = newPro._id;
        booking.arrivalStatus = 'pending';
        changes.professional = { from: oldProId, to: newPro._id, name: newPro.name };
      }

      if (counsellorId !== undefined) {
        if (counsellorId === null || counsellorId === '') {
          booking.assignedCounsellor = null;
          changes.counsellor = { to: null };
        } else {
          assertValidId(counsellorId, 'counsellorId');
          const counsellor = await User.findOne({
            _id: counsellorId,
            role: 'counsellor',
            accountStatus: 'active',
          })
            .select('_id name')
            .session(mongoSession);
          if (!counsellor) throw httpError(400, 'The counsellor must be an active user with role counsellor.');
          booking.assignedCounsellor = counsellor._id;
          changes.counsellor = { to: counsellor._id, name: counsellor.name };
        }
      }

      await booking.save({ session: mongoSession });
      result = { bookingId: booking._id, changes, sessionsReassigned: movedSessions };
    });

    const booking = await Booking.findById(result.bookingId)
      .populate('assignedProfessional', 'name phone role')
      .populate('assignedCounsellor', 'name phone')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Booking reassigned.',
      data: { booking, ...result },
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

// Shift all not-yet-started sessions of a booking to a new start date/slot
const adminRescheduleBooking = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { id } = req.params;
    assertValidId(id, 'booking id');
    const { scheduledDate, timeSlot, reason = '' } = req.body;
    const newBase = parseFutureDate(scheduledDate);

    let result = null;

    await mongoSession.withTransaction(async () => {
      const booking = await Booking.findById(id).session(mongoSession);
      if (!booking) throw httpError(404, 'Booking not found.');
      if (['completed', 'cancelled'].includes(booking.status)) {
        throw httpError(400, `A ${booking.status} booking cannot be rescheduled.`);
      }

      const sessions = await Session.find({ booking: booking._id })
        .sort({ sessionNumber: 1 })
        .session(mongoSession);
      if (sessions.some((s) => ['professional_arrived', 'in_progress'].includes(s.status))) {
        throw httpError(409, 'A session is already under way and cannot be rescheduled.', 'SESSION_ACTIVE');
      }

      const movable = sessions.filter((s) => s.status === 'scheduled');
      if (movable.length === 0) throw httpError(400, 'There are no scheduled sessions to move.');

      const moved = [];
      for (let i = 0; i < movable.length; i += 1) {
        const s = movable[i];
        const oldDate = s.scheduledDate;
        s.scheduledDate = new Date(newBase.getTime() + i * DAY_MS);
        await s.save({ session: mongoSession });
        await logSessionEvent(mongoSession, {
          session: s,
          booking,
          admin: req.user,
          action: 'SESSION_RESCHEDULED',
          previousStatus: s.status,
          newStatus: s.status,
          metadata: { from: oldDate, to: s.scheduledDate, timeSlot: timeSlot || booking.timeSlot, reason },
        });
        moved.push({ sessionId: s._id, sessionNumber: s.sessionNumber, scheduledDate: s.scheduledDate });
      }

      booking.scheduledDate = newBase;
      if (timeSlot) booking.timeSlot = String(timeSlot).trim();
      await booking.save({ session: mongoSession });

      result = { bookingId: booking._id, timeSlot: booking.timeSlot, moved };
    });

    return res.status(200).json({ success: true, message: 'Booking rescheduled.', data: result });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

// Fulfil a make-up session for a booking cancelled because the professional did not show
const adminCreateMakeUpBooking = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { id } = req.params;
    assertValidId(id, 'booking id');
    const { professionalId, scheduledDate, timeSlot, payoutAmount, note = '' } = req.body;
    if (!professionalId) throw httpError(400, 'professionalId is required.');
    if (!timeSlot || !String(timeSlot).trim()) throw httpError(400, 'timeSlot is required.');
    const date = parseFutureDate(scheduledDate);

    let created = null;

    await mongoSession.withTransaction(async () => {
      const original = await Booking.findById(id).session(mongoSession);
      if (!original) throw httpError(404, 'Booking not found.');
      if (original.makeUpSessionStatus !== 'eligible') {
        throw httpError(
          409,
          `This booking is not eligible for a make-up session (status: ${original.makeUpSessionStatus}).`,
          'NOT_ELIGIBLE'
        );
      }

      const [service, pkg] = await Promise.all([
        Service.findById(original.service).session(mongoSession),
        Package.findById(original.package).session(mongoSession),
      ]);
      if (!service || !pkg) throw httpError(404, 'Service or package no longer exists.');

      const pro = await loadAssignableProfessional(professionalId, service.type, mongoSession);

      const payout =
        payoutAmount === undefined || payoutAmount === null || payoutAmount === ''
          ? Number(original.perSessionPayoutAmount || 0)
          : Number(payoutAmount);
      if (!Number.isFinite(payout) || payout < 0) throw httpError(400, 'payoutAmount must be 0 or more.');

      const [booking] = await Booking.create(
        [
          {
            user: original.user,
            pet: original.pet,
            service: original.service,
            package: original.package,
            assignedProfessional: pro._id,
            assignedCounsellor: null,
            bookingType: 'replacement_session',
            totalAmount: 0,
            perSessionAmount: 0,
            perSessionPayoutAmount: payout,
            addressSnapshot: original.toObject().addressSnapshot,
            scheduledDate: date,
            timeSlot: String(timeSlot).trim(),
            status: 'upcoming',
            arrivalStatus: 'pending',
            serviceCompletionStatus: 'not_started',
            totalSessionCount: 1,
            completedSessionCount: 0,
            sessionIds: [],
          },
        ],
        { session: mongoSession }
      );

      const [session] = await Session.create(
        [
          {
            booking: booking._id,
            sessionNumber: 1,
            professional: pro._id,
            customer: original.user,
            pet: original.pet,
            sessionAmount: 0,
            professionalPayoutAmount: payout,
            walletSettled: false,
            scheduledDate: date,
            scheduledDurationMinutes: Number(pkg.sessionDuration || service.sessionDuration || 45),
            status: 'scheduled',
            arrivalVerificationStatus: 'pending',
          },
        ],
        { session: mongoSession }
      );

      booking.sessionIds = [session._id];
      await booking.save({ session: mongoSession });

      original.makeUpSessionStatus = 'scheduled';
      await original.save({ session: mongoSession });

      await logSessionEvent(mongoSession, {
        session,
        booking,
        admin: req.user,
        action: 'MAKE_UP_SCHEDULED',
        previousStatus: null,
        newStatus: 'scheduled',
        metadata: { makeUpForBooking: original._id, payoutAmount: payout, note },
      });

      created = { bookingId: booking._id, sessionId: session._id, makeUpForBooking: original._id };
    });

    return res.status(201).json({
      success: true,
      message: 'Make-up session scheduled at no charge to the client.',
      data: created,
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------
const adminListSessions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filter = {};

    if (req.query.status) {
      if (!SESSION_STATUSES.includes(req.query.status)) {
        throw httpError(400, `status must be one of: ${SESSION_STATUSES.join(', ')}.`);
      }
      filter.status = req.query.status;
    }
    if (req.query.walletSettled === 'true') filter.walletSettled = true;
    if (req.query.walletSettled === 'false') filter.walletSettled = false;
    ['professionalId:professional', 'customerId:customer', 'bookingId:booking'].forEach((pair) => {
      const [param, field] = pair.split(':');
      if (req.query[param]) {
        assertValidId(req.query[param], param);
        filter[field] = req.query[param];
      }
    });
    if (req.query.dateFrom || req.query.dateTo) {
      filter.scheduledDate = {};
      if (req.query.dateFrom) filter.scheduledDate.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.scheduledDate.$lte = new Date(req.query.dateTo);
    }

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .select('-coordinates')
        .populate('pet', 'name species')
        .populate('professional', 'name phone role')
        .populate('customer', 'name phone')
        .sort({ scheduledDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Session.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        sessions,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Add ?includeRoute=true to also return the GPS points
const adminGetSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    assertValidId(sessionId, 'session id');
    const includeRoute = req.query.includeRoute === 'true';

    const query = Session.findById(sessionId)
      .populate('pet', 'name species breed')
      .populate('professional', 'name phone role')
      .populate('customer', 'name phone')
      .populate({
        path: 'booking',
        select: 'bookingType status addressSnapshot scheduledDate timeSlot',
        populate: { path: 'service', select: 'type title' },
      })
      .populate('review');
    if (!includeRoute) query.select('-coordinates');

    const session = await query.lean();
    if (!session) throw httpError(404, 'Session not found.');

    const [routePoints, auditLogs, transactions] = await Promise.all([
      includeRoute
        ? Promise.resolve(session.coordinates?.length || 0)
        : Session.findById(sessionId).select('coordinates').lean().then((s) => s?.coordinates?.length || 0),
      SessionAuditLog.find({ session: session._id })
        .populate('actor', 'name role')
        .sort({ timestamp: -1 })
        .lean(),
      WalletTransaction.find({ session: session._id }).sort({ createdAt: 1 }).lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: { session, routePoints, auditLogs, transactions },
    });
  } catch (err) {
    return next(err);
  }
};

// Update scheduled date/time, duration, and/or actual start/end timestamps on a session
const adminRescheduleSession = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { sessionId } = req.params;
    assertValidId(sessionId, 'session id');

    const {
      scheduledDate,
      scheduledDurationMinutes,
      startedAt,
      endedAt,
      reason = '',
    } = req.body;

    const hasScheduleDate = scheduledDate !== undefined && scheduledDate !== null && scheduledDate !== '';
    const hasDuration =
      scheduledDurationMinutes !== undefined &&
      scheduledDurationMinutes !== null &&
      scheduledDurationMinutes !== '';
    const hasStartedAt = startedAt !== undefined && startedAt !== null && startedAt !== '';
    const hasEndedAt = endedAt !== undefined && endedAt !== null && endedAt !== '';

    if (!hasScheduleDate && !hasDuration && !hasStartedAt && !hasEndedAt) {
      throw httpError(
        400,
        'Provide at least one of: scheduledDate, scheduledDurationMinutes, startedAt, or endedAt.'
      );
    }

    let parsedScheduledDate = null;
    if (hasScheduleDate) {
      parsedScheduledDate = new Date(scheduledDate);
      if (Number.isNaN(parsedScheduledDate.getTime())) {
        throw httpError(400, 'scheduledDate must be a valid date.');
      }
    }

    let parsedDuration = null;
    if (hasDuration) {
      parsedDuration = Number(scheduledDurationMinutes);
      if (!Number.isFinite(parsedDuration) || parsedDuration < 5 || parsedDuration > 300) {
        throw httpError(400, 'scheduledDurationMinutes must be a number between 5 and 300.');
      }
      parsedDuration = Math.round(parsedDuration);
    }

    let parsedStartedAt = null;
    if (hasStartedAt) {
      parsedStartedAt = new Date(startedAt);
      if (Number.isNaN(parsedStartedAt.getTime())) {
        throw httpError(400, 'startedAt must be a valid date.');
      }
    }

    let parsedEndedAt = null;
    if (hasEndedAt) {
      parsedEndedAt = new Date(endedAt);
      if (Number.isNaN(parsedEndedAt.getTime())) {
        throw httpError(400, 'endedAt must be a valid date.');
      }
    }

    let result = null;

    await mongoSession.withTransaction(async () => {
      const session = await Session.findById(sessionId).session(mongoSession);
      if (!session) throw httpError(404, 'Session not found.');

      const booking = await Booking.findById(session.booking).session(mongoSession);
      if (!booking) throw httpError(404, 'Booking not found.');

      // Only allow moving scheduledDate when session is scheduled (or disputed/interrupted via resolve)
      if (hasScheduleDate && session.status !== 'scheduled') {
        throw httpError(
          409,
          `scheduledDate can only be changed when session status is scheduled (current: ${session.status}).`
        );
      }

      // Prevent altering start/end times on cancelled sessions unless intended
      if ((hasStartedAt || hasEndedAt) && session.status === 'cancelled') {
        throw httpError(409, 'Cannot modify start or end time of a cancelled session.');
      }

      const effectiveStart = hasStartedAt ? parsedStartedAt : session.startedAt;
      const effectiveEnd = hasEndedAt ? parsedEndedAt : session.endedAt;

      if (effectiveStart && effectiveEnd && effectiveEnd.getTime() < effectiveStart.getTime()) {
        throw httpError(400, 'endedAt cannot be earlier than startedAt.');
      }

      const beforeSnapshot = {
        scheduledDate: session.scheduledDate,
        scheduledDurationMinutes: session.scheduledDurationMinutes,
        scheduledEndAt: session.scheduledEndAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        actualDurationSeconds: session.actualDurationSeconds,
      };

      if (hasScheduleDate) {
        session.scheduledDate = parsedScheduledDate;
      }

      if (hasDuration) {
        session.scheduledDurationMinutes = parsedDuration;
      }

      const baseStartForScheduledEnd = session.scheduledDate;
      const durationMinsForScheduledEnd = session.scheduledDurationMinutes;
      if (baseStartForScheduledEnd && durationMinsForScheduledEnd) {
        session.scheduledEndAt = new Date(
          baseStartForScheduledEnd.getTime() + durationMinsForScheduledEnd * 60 * 1000
        );
      }

      if (hasStartedAt) {
        session.startedAt = parsedStartedAt;
      }

      if (hasEndedAt) {
        session.endedAt = parsedEndedAt;
      }

      if (session.startedAt && session.endedAt) {
        session.actualDurationSeconds = Math.max(
          0,
          Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
        );
      }

      await session.save({ session: mongoSession });

      if (hasScheduleDate && session.status === 'scheduled') {
        const scheduled = await Session.find({ booking: booking._id, status: 'scheduled' })
          .select('scheduledDate')
          .session(mongoSession);
        if (scheduled.length > 0) {
          booking.scheduledDate = new Date(Math.min(...scheduled.map((s) => s.scheduledDate.getTime())));
          await booking.save({ session: mongoSession });
        }
      }

      const afterSnapshot = {
        scheduledDate: session.scheduledDate,
        scheduledDurationMinutes: session.scheduledDurationMinutes,
        scheduledEndAt: session.scheduledEndAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        actualDurationSeconds: session.actualDurationSeconds,
      };

      await logSessionEvent(mongoSession, {
        session,
        booking,
        admin: req.user,
        action: 'SESSION_TIMING_UPDATED',
        previousStatus: session.status,
        newStatus: session.status,
        metadata: {
          reason,
          from: beforeSnapshot,
          to: afterSnapshot,
        },
      });

      result = {
        sessionId: session._id,
        bookingId: booking._id,
        session: {
          _id: session._id,
          status: session.status,
          scheduledDate: session.scheduledDate,
          scheduledDurationMinutes: session.scheduledDurationMinutes,
          scheduledEndAt: session.scheduledEndAt,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          actualDurationSeconds: session.actualDurationSeconds,
        },
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Session schedule and timing updated.',
      data: result,
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

// Resolve a disputed / interrupted session: complete it, cancel it, or schedule it again
const adminResolveSession = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { sessionId } = req.params;
    assertValidId(sessionId, 'session id');
    const { resolution, notes = '', scheduledDate, makeUpEligible = false } = req.body;

    if (!['complete', 'cancel', 'reschedule'].includes(resolution)) {
      throw httpError(400, 'resolution must be "complete", "cancel" or "reschedule".');
    }
    const cleanNotes = String(notes).trim();
    if (!cleanNotes) throw httpError(400, 'Resolution notes are required for the audit trail.');
    const newDate = resolution === 'reschedule' ? parseFutureDate(scheduledDate) : null;

    let result = null;

    await mongoSession.withTransaction(async () => {
      const session = await Session.findById(sessionId).session(mongoSession);
      if (!session) throw httpError(404, 'Session not found.');
      if (!['disputed', 'interrupted'].includes(session.status)) {
        throw httpError(
          409,
          `Only disputed or interrupted sessions can be resolved (this one is ${session.status}).`,
          'NOT_RESOLVABLE'
        );
      }
      const booking = await Booking.findById(session.booking).session(mongoSession);
      if (!booking) throw httpError(404, 'Booking not found.');

      const prev = session.status;
      const now = new Date();
      const label = `ADMIN ${resolution.toUpperCase()}`;
      session.completionNotes = appendNote(session.completionNotes, label, cleanNotes);

      if (resolution === 'complete') {
        session.status = 'completed';
        session.endedAt = session.endedAt || now;
        if (!session.actualDurationSeconds && session.startedAt) {
          session.actualDurationSeconds = Math.max(
            0,
            Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
          );
        }
        session.completionConfirmedBy = req.user._id;
        session.completionConfirmedAt = now;
        await session.save({ session: mongoSession });
        // Booking counters are updated by settleCompletedSession below
      } else if (resolution === 'cancel') {
        session.status = 'cancelled';
        await session.save({ session: mongoSession });
        await recomputeBookingState(booking, mongoSession);
        if (booking.status === 'cancelled') {
          booking.cancellationDetails = {
            cancelledBy: req.user._id,
            cancelledAt: now,
            reason: cleanNotes,
            cancellationFee: 0,
            noShowType: 'disputed',
          };
        }
        if (makeUpEligible) booking.makeUpSessionStatus = 'eligible';
        await booking.save({ session: mongoSession });
      } else {
        session.status = 'scheduled';
        session.scheduledDate = newDate;
        session.arrivalAt = null;
        session.arrivalVerificationStatus = 'pending';
        session.startedAt = null;
        session.scheduledEndAt = null;
        session.endedAt = null;
        session.actualDurationSeconds = 0;
        await session.save({ session: mongoSession });
        booking.arrivalStatus = 'pending';
        if (booking.status === 'active') booking.status = 'upcoming';
        await booking.save({ session: mongoSession });
      }

      await logSessionEvent(mongoSession, {
        session,
        booking,
        admin: req.user,
        action: 'DISPUTE_RESOLVED',
        previousStatus: prev,
        newStatus: session.status,
        metadata: { resolution, notes: cleanNotes, scheduledDate: newDate, makeUpEligible: Boolean(makeUpEligible) },
      });

      result = { sessionId: session._id, bookingId: booking._id, previousStatus: prev, newStatus: session.status };
    });

    let settlement = null;
    let settlementError = null;
    if (resolution === 'complete') {
      try {
        settlement = await settleCompletedSession({
          sessionId,
          actorId: req.user._id,
          actorRole: 'admin',
        });
        emitSessionEvent(sessionId, 'session_completed', {
          sessionId,
          status: 'completed',
          settlement,
        });
      } catch (settleErr) {
        // The session is already completed; the admin can retry settlement later
        settlementError = settleErr.message;
      }
    } else {
      emitSessionEvent(sessionId, 'session_status_changed', {
        sessionId,
        status: result.newStatus,
        serverTime: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: settlementError
        ? 'Session completed, but wallet settlement failed. Use retry-settlement once the issue is fixed.'
        : 'Session resolved.',
      data: { ...result, settlement, settlementError },
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

// Safe to repeat: settleCompletedSession is idempotent
const adminRetrySettlement = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    assertValidId(sessionId, 'session id');

    const session = await Session.findById(sessionId).select('status walletSettled').lean();
    if (!session) throw httpError(404, 'Session not found.');
    if (session.status !== 'completed') {
      throw httpError(409, `Only completed sessions can be settled (this one is ${session.status}).`);
    }

    const settlement = await settleCompletedSession({
      sessionId,
      actorId: req.user._id,
      actorRole: 'admin',
    });

    if (!settlement.alreadySettled) {
      emitSessionEvent(sessionId, 'session_completed', { sessionId, status: 'completed', settlement });
    }

    return res.status(200).json({
      success: true,
      message: settlement.alreadySettled
        ? 'This session was already settled. No money moved.'
        : 'Session settled.',
      data: { settlement },
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------------------------------------------------------------
// Operations queue: everything that needs an admin's attention
// ---------------------------------------------------------------------------
const adminOpsQueue = async (req, res, next) => {
  try {
    const now = new Date();
    const overdueBefore = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const LIMIT = 100;

    const slim = (q) =>
      q
        .select('-coordinates')
        .populate('pet', 'name species')
        .populate('professional', 'name phone role')
        .populate('customer', 'name phone')
        .lean();

    // Professionals who can no longer serve: suspended/deleted accounts or no longer verified
    const [inactivePros, unverifiedProfiles] = await Promise.all([
      User.find({ role: { $in: PROFESSIONAL_ROLES }, accountStatus: { $ne: 'active' } })
        .select('_id')
        .lean(),
      ProfessionalProfile.find({ verificationStatus: { $ne: 'verified' } }).select('user').lean(),
    ]);
    const blockedProIds = [
      ...inactivePros.map((u) => u._id),
      ...unverifiedProfiles.map((p) => p.user),
    ];

    const [disputed, unsettled, overdue, stranded] = await Promise.all([
      slim(
        Session.find({ status: { $in: ['disputed', 'interrupted'] } })
          .sort({ updatedAt: -1 })
          .limit(LIMIT)
      ),
      slim(Session.find({ status: 'completed', walletSettled: false }).sort({ endedAt: -1 }).limit(LIMIT)),
      slim(
        Session.find({ status: 'scheduled', scheduledDate: { $lt: overdueBefore } })
          .sort({ scheduledDate: 1 })
          .limit(LIMIT)
      ),
      blockedProIds.length
        ? slim(
            Session.find({
              professional: { $in: blockedProIds },
              status: { $in: OPEN_SESSION_STATUSES },
            })
              .sort({ scheduledDate: 1 })
              .limit(LIMIT)
          )
        : Promise.resolve([]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        generatedAt: now.toISOString(),
        counts: {
          disputedOrInterrupted: disputed.length,
          completedButUnsettled: unsettled.length,
          overdueNotStarted: overdue.length,
          assignedToUnavailableProfessional: stranded.length,
        },
        disputedOrInterrupted: disputed,
        completedButUnsettled: unsettled,
        overdueNotStarted: overdue,
        assignedToUnavailableProfessional: stranded,
        note: `Each list shows at most ${LIMIT} sessions.`,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  adminListBookings,
  adminGetBooking,
  adminReassignBooking,
  adminRescheduleBooking,
  adminCreateMakeUpBooking,
  adminListSessions,
  adminGetSession,
  adminRescheduleSession,
  adminResolveSession,
  adminRetrySettlement,
  adminOpsQueue,
};