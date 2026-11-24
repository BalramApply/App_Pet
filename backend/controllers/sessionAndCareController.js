const mongoose = require('mongoose');
const Session = require('../models/Session');
const Booking = require('../models/Booking');
const SessionAuditLog = require('../models/SessionAuditLog');
const SessionReview = require('../models/SessionReview');
const ProfessionalProfile = require('../models/ProfessionalProfile');
const VaccinationRecord = require('../models/VaccinationRecord');
const SupportTicket = require('../models/SupportTicket');
const Pet = require('../models/Pet');
const { settleCompletedSession } = require('../utils/walletSettlement');
const { getIO } = require('../sockets/socketServer');

const emitSessionEvent = (sessionId, eventName, payload) => {
  const io = getIO();
  if (io) {
    io.to(`session:${sessionId.toString()}`).emit(eventName, payload);
  }
};

// customer / professional may be a raw ObjectId or a populated user object
const refId = (ref) => ((ref && ref._id) || ref).toString();

const verifySessionActor = (sessionDoc, user, allowedRoles = []) => {
  const userId = user._id.toString();
  const isCustomer = refId(sessionDoc.customer) === userId;
  const isPro = refId(sessionDoc.professional) === userId;
  const isAdmin = user.role === 'admin';

  if (allowedRoles.includes('professional_only') && !isPro && !isAdmin) {
    const err = new Error('Only the assigned professional or admin can perform this action.');
    err.statusCode = 403;
    throw err;
  }

  if (!isCustomer && !isPro && !isAdmin) {
    const err = new Error('Not authorized to access this session.');
    err.statusCode = 403;
    throw err;
  }

  return { isCustomer, isPro, isAdmin };
};

const arriveSession = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { sessionId } = req.params;
    const { verifyArrival = true, lat, lng } = req.body;

    let resultSession = null;

    await mongoSession.withTransaction(async () => {
      const sessionDoc = await Session.findById(sessionId).session(mongoSession);
      if (!sessionDoc) {
        const err = new Error('Session not found.');
        err.statusCode = 404;
        throw err;
      }

      verifySessionActor(sessionDoc, req.user, ['professional_only']);

      if (!['scheduled', 'professional_arrived'].includes(sessionDoc.status)) {
        const err = new Error(`Cannot mark arrival when session status is "${sessionDoc.status}".`);
        err.statusCode = 400;
        throw err;
      }

      const prevStatus = sessionDoc.status;
      const now = new Date();
      sessionDoc.arrivalAt = sessionDoc.arrivalAt || now;
      sessionDoc.arrivalVerificationStatus = verifyArrival ? 'verified' : 'arrived';
      sessionDoc.status = 'professional_arrived';

      if (typeof lat === 'number' && typeof lng === 'number') {
        sessionDoc.latestLocation = { lat, lng, updatedAt: now };
        sessionDoc.coordinates.push({ lat, lng, recordedAt: now });
      }

      await sessionDoc.save({ session: mongoSession });

      await Booking.findByIdAndUpdate(
        sessionDoc.booking,
        {
          $set: {
            arrivalStatus: sessionDoc.arrivalVerificationStatus,
            status: 'active',
          },
        },
        { session: mongoSession }
      );

      await SessionAuditLog.create(
        [
          {
            session: sessionDoc._id,
            booking: sessionDoc.booking,
            actor: req.user._id,
            actorRole: req.user.role,
            action: 'PROFESSIONAL_ARRIVED',
            previousStatus: prevStatus,
            newStatus: sessionDoc.status,
            timestamp: now,
            metadata: { arrivalVerificationStatus: sessionDoc.arrivalVerificationStatus },
          },
        ],
        { session: mongoSession }
      );

      resultSession = sessionDoc;
    });

    emitSessionEvent(resultSession._id, 'session_status_changed', {
      sessionId: resultSession._id,
      status: resultSession.status,
      arrivalVerificationStatus: resultSession.arrivalVerificationStatus,
      arrivalAt: resultSession.arrivalAt,
      serverTime: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: 'Arrival recorded and verified.',
      data: { session: resultSession },
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

const startSession = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { sessionId } = req.params;
    let resultSession = null;

    await mongoSession.withTransaction(async () => {
      const sessionDoc = await Session.findById(sessionId).session(mongoSession);
      if (!sessionDoc) {
        const err = new Error('Session not found.');
        err.statusCode = 404;
        throw err;
      }

      verifySessionActor(sessionDoc, req.user, ['professional_only']);

      if (sessionDoc.arrivalVerificationStatus !== 'verified' && req.user.role !== 'admin') {
        const err = new Error('Arrival must be verified before starting the session.');
        err.statusCode = 400;
        throw err;
      }

      if (!['professional_arrived', 'scheduled'].includes(sessionDoc.status)) {
        const err = new Error(`Session cannot be started from status "${sessionDoc.status}".`);
        err.statusCode = 400;
        throw err;
      }

      const prevStatus = sessionDoc.status;
      const now = new Date();
      const durationMs = Number(sessionDoc.scheduledDurationMinutes || 45) * 60 * 1000;
      const scheduledEndAt = new Date(now.getTime() + durationMs);

      sessionDoc.status = 'in_progress';
      sessionDoc.startedAt = now;
      sessionDoc.scheduledEndAt = scheduledEndAt;
      await sessionDoc.save({ session: mongoSession });

      await Booking.findByIdAndUpdate(
        sessionDoc.booking,
        {
          $set: {
            status: 'active',
            arrivalStatus: 'verified',
            serviceCompletionStatus: 'in_progress',
          },
        },
        { session: mongoSession }
      );

      await SessionAuditLog.create(
        [
          {
            session: sessionDoc._id,
            booking: sessionDoc.booking,
            actor: req.user._id,
            actorRole: req.user.role,
            action: 'SESSION_STARTED',
            previousStatus: prevStatus,
            newStatus: 'in_progress',
            timestamp: now,
            metadata: {
              startedAt: now,
              scheduledEndAt,
              scheduledDurationMinutes: sessionDoc.scheduledDurationMinutes,
            },
          },
        ],
        { session: mongoSession }
      );

      resultSession = sessionDoc;
    });

    const nowMs = Date.now();
    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(resultSession.scheduledEndAt).getTime() - nowMs) / 1000)
    );

    emitSessionEvent(resultSession._id, 'session_status_changed', {
      sessionId: resultSession._id,
      status: resultSession.status,
      startedAt: resultSession.startedAt,
      scheduledEndAt: resultSession.scheduledEndAt,
      remainingSeconds,
      serverTime: new Date(nowMs).toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: 'Session started with server-authoritative timer.',
      data: {
        session: resultSession,
        remainingSeconds,
      },
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

const completeSession = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { sessionId } = req.params;
    const {
      reportNotes = '',
      completionNotes = '',
      media = [],
      checklist = [],
      behaviorScores = null,
    } = req.body;

    let prevStatus = null;
    let updatedSession = null;

    await mongoSession.withTransaction(async () => {
      const sessionDoc = await Session.findById(sessionId).session(mongoSession);
      if (!sessionDoc) {
        const err = new Error('Session not found.');
        err.statusCode = 404;
        throw err;
      }

      verifySessionActor(sessionDoc, req.user, ['professional_only']);

      if (
        !['in_progress', 'duration_completed', 'professional_arrived'].includes(sessionDoc.status) &&
        req.user.role !== 'admin'
      ) {
        const err = new Error(`Session cannot be completed from status "${sessionDoc.status}".`);
        err.statusCode = 400;
        throw err;
      }

      prevStatus = sessionDoc.status;
      const now = new Date();
      const startTime = sessionDoc.startedAt ? new Date(sessionDoc.startedAt).getTime() : now.getTime();
      const elapsedSec = Math.max(0, Math.floor((now.getTime() - startTime) / 1000));

      sessionDoc.status = 'completed';
      sessionDoc.endedAt = now;
      sessionDoc.actualDurationSeconds = elapsedSec;
      sessionDoc.completionConfirmedBy = req.user._id;
      sessionDoc.completionConfirmedAt = now;

      if (reportNotes) sessionDoc.reportNotes = reportNotes;
      if (completionNotes) sessionDoc.completionNotes = completionNotes;
      if (Array.isArray(media) && media.length > 0) {
        sessionDoc.media.push(...media);
      }
      if (Array.isArray(checklist) && checklist.length > 0) {
        sessionDoc.checklist = checklist;
      }
      if (behaviorScores && typeof behaviorScores === 'object') {
        sessionDoc.behaviorScores = {
          ...sessionDoc.behaviorScores?.toObject?.(),
          ...behaviorScores,
        };
      }

      await sessionDoc.save({ session: mongoSession });

      if (behaviorScores?.overallProgressScore !== undefined && behaviorScores.overallProgressScore !== null) {
        await Pet.findByIdAndUpdate(
          sessionDoc.pet,
          {
            $set: { 'behaviourSummary.latestBehaviorScore': Number(behaviorScores.overallProgressScore) },
          },
          { session: mongoSession }
        );
      }

      await SessionAuditLog.create(
        [
          {
            session: sessionDoc._id,
            booking: sessionDoc.booking,
            actor: req.user._id,
            actorRole: req.user.role,
            action: 'SESSION_COMPLETED',
            previousStatus: prevStatus,
            newStatus: 'completed',
            timestamp: now,
            metadata: {
              actualDurationSeconds: elapsedSec,
              completionNotes,
            },
          },
        ],
        { session: mongoSession }
      );

      updatedSession = sessionDoc;
    });

    // Atomically deduct from Client wallet & credit Professional wallet (idempotent)
    const settlement = await settleCompletedSession({
      sessionId: updatedSession._id,
      actorId: req.user._id,
      actorRole: req.user.role,
    });

    const finalSession = await Session.findById(updatedSession._id).lean();

    emitSessionEvent(finalSession._id, 'session_completed', {
      sessionId: finalSession._id,
      status: 'completed',
      endedAt: finalSession.endedAt,
      actualDurationSeconds: finalSession.actualDurationSeconds,
      settlement,
    });

    return res.status(200).json({
      success: true,
      message: 'Session completed and wallet settled atomically.',
      data: {
        session: finalSession,
        settlement,
      },
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

const interruptOrDisputeSession = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { sessionId } = req.params;
    const { targetStatus = 'interrupted', reason = '' } = req.body;

    if (!['interrupted', 'disputed'].includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: 'targetStatus must be "interrupted" or "disputed".',
      });
    }

    let updatedSession = null;

    await mongoSession.withTransaction(async () => {
      const sessionDoc = await Session.findById(sessionId).session(mongoSession);
      if (!sessionDoc) {
        const err = new Error('Session not found.');
        err.statusCode = 404;
        throw err;
      }

      verifySessionActor(sessionDoc, req.user);

      const prevStatus = sessionDoc.status;
      const now = new Date();
      sessionDoc.status = targetStatus;
      sessionDoc.endedAt = now;
      if (reason) {
        sessionDoc.completionNotes = sessionDoc.completionNotes
          ? `${sessionDoc.completionNotes} | [${targetStatus.toUpperCase()}]: ${reason}`
          : `[${targetStatus.toUpperCase()}]: ${reason}`;
      }
      await sessionDoc.save({ session: mongoSession });

      await SessionAuditLog.create(
        [
          {
            session: sessionDoc._id,
            booking: sessionDoc.booking,
            actor: req.user._id,
            actorRole: req.user.role,
            action: targetStatus === 'disputed' ? 'SESSION_DISPUTED' : 'SESSION_INTERRUPTED',
            previousStatus: prevStatus,
            newStatus: targetStatus,
            timestamp: now,
            metadata: { reason },
          },
        ],
        { session: mongoSession }
      );

      updatedSession = sessionDoc;
    });

    emitSessionEvent(updatedSession._id, 'session_status_changed', {
      sessionId: updatedSession._id,
      status: updatedSession.status,
      reason,
      serverTime: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: `Session marked as ${targetStatus}.`,
      data: { session: updatedSession },
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

const getSessionById = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const sessionDoc = await Session.findById(sessionId)
      .populate('pet', 'name species breed age gender photos')
      .populate('professional', 'name phone role')
      .populate('customer', 'name phone')
      .populate({
        path: 'booking',
        populate: { path: 'service package', select: 'type title name price freeDemoEligible' },
      })
      .lean();

    if (!sessionDoc) {
      return res.status(404).json({ success: false, message: 'Session not found.' });
    }

    verifySessionActor(sessionDoc, req.user);

    const auditLogs = await SessionAuditLog.find({ session: sessionDoc._id })
      .sort({ timestamp: -1 })
      .lean();

    const nowMs = Date.now();
    const endMs = sessionDoc.scheduledEndAt ? new Date(sessionDoc.scheduledEndAt).getTime() : null;
    const remainingSeconds =
      endMs && sessionDoc.status === 'in_progress'
        ? Math.max(0, Math.floor((endMs - nowMs) / 1000))
        : 0;
    const elapsedSeconds = sessionDoc.startedAt
      ? Math.max(0, Math.floor((nowMs - new Date(sessionDoc.startedAt).getTime()) / 1000))
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        session: sessionDoc,
        auditLogs,
        timer: {
          serverTime: new Date(nowMs).toISOString(),
          elapsedSeconds,
          remainingSeconds,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Session-specific review (1 review per eligible completed session per customer)
const createSessionReview = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { sessionId } = req.params;
    const { rating, criteria, reviewText = '' } = req.body;

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5.',
      });
    }

    let createdReview = null;

    await mongoSession.withTransaction(async () => {
      const sessionDoc = await Session.findById(sessionId).session(mongoSession);
      if (!sessionDoc) {
        const err = new Error('Session not found.');
        err.statusCode = 404;
        throw err;
      }

      if (sessionDoc.customer.toString() !== req.user._id.toString()) {
        const err = new Error('Only the session customer can submit a review.');
        err.statusCode = 403;
        throw err;
      }

      if (sessionDoc.status !== 'completed') {
        const err = new Error('Reviews can only be submitted after session completion.');
        err.statusCode = 400;
        throw err;
      }

      if (sessionDoc.review) {
        const err = new Error('A review has already been submitted for this session.');
        err.statusCode = 409;
        throw err;
      }

      const [reviewDoc] = await SessionReview.create(
        [
          {
            session: sessionDoc._id,
            booking: sessionDoc.booking,
            customer: req.user._id,
            professional: sessionDoc.professional,
            pet: sessionDoc.pet,
            rating: Number(rating),
            criteria: criteria || { punctuality: 5, petCare: 5, communication: 5 },
            reviewText: String(reviewText).trim(),
            moderationStatus: 'published',
          },
        ],
        { session: mongoSession }
      );

      sessionDoc.review = reviewDoc._id;
      sessionDoc.reviewEligible = false;
      await sessionDoc.save({ session: mongoSession });

      // Recalculate professional averageRating & totalEligibleReviews
      const publishedReviews = await SessionReview.find({
        professional: sessionDoc.professional,
        moderationStatus: 'published',
      }).session(mongoSession);

      const count = publishedReviews.length;
      const avg =
        count > 0
          ? Number(
              (
                publishedReviews.reduce((acc, r) => acc + Number(r.rating), 0) / count
              ).toFixed(2)
            )
          : 0;

      await ProfessionalProfile.findOneAndUpdate(
        { user: sessionDoc.professional },
        {
          $set: {
            averageRating: avg,
            totalEligibleReviews: count,
          },
        },
        { session: mongoSession }
      );

      createdReview = reviewDoc;
    });

    return res.status(201).json({
      success: true,
      message: 'Review submitted.',
      data: { review: createdReview },
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

// Vaccination & Health Vault
const createVaccinationRecord = async (req, res, next) => {
  try {
    const {
      petId,
      customerId,
      bookingId,
      sessionId,
      vaccineName,
      vaccineCode,
      doseNumber,
      batchNumber,
      administeredDate,
      nextDueDate,
      certificateUrl,
      clinicOrHomeNotes,
    } = req.body;

    if (!petId || !vaccineName) {
      return res.status(400).json({
        success: false,
        message: 'petId and vaccineName are required.',
      });
    }

    const pet = await Pet.findById(petId).lean();
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }

    const ownerId = customerId || pet.user;
    if (pet.user.toString() !== req.user._id.toString() && req.user.role === 'pet_parent') {
      return res.status(403).json({ success: false, message: 'Not authorized for this pet.' });
    }

    const adminDate = administeredDate ? new Date(administeredDate) : new Date();
    const computedNextDue = nextDueDate
      ? new Date(nextDueDate)
      : new Date(adminDate.getTime() + 365 * 24 * 60 * 60 * 1000);

    const record = await VaccinationRecord.create({
      pet: pet._id,
      customer: ownerId,
      booking: bookingId || null,
      session: sessionId || null,
      vaccineName: String(vaccineName).trim(),
      vaccineCode: vaccineCode || '',
      doseNumber: Number(doseNumber || 1),
      batchNumber: batchNumber || '',
      administeredDate: adminDate,
      nextDueDate: computedNextDue,
      certificateUrl: certificateUrl || '',
      administeredBy: req.user._id,
      clinicOrHomeNotes: clinicOrHomeNotes || '',
    });

    return res.status(201).json({
      success: true,
      message: 'Vaccination record saved.',
      data: { vaccinationRecord: record },
    });
  } catch (err) {
    return next(err);
  }
};

const getPetHealthRecords = async (req, res, next) => {
  try {
    const { petId } = req.params;
    const pet = await Pet.findById(petId).lean();
    if (!pet) {
      return res.status(404).json({ success: false, message: 'Pet not found.' });
    }

    if (
      pet.user.toString() !== req.user._id.toString() &&
      !['vet', 'paravet', 'trainer', 'walker', 'groomer', 'counsellor', 'relationship_manager', 'admin'].includes(
        req.user.role
      )
    ) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const [vaccinations, sessions] = await Promise.all([
      VaccinationRecord.find({ pet: pet._id })
        .populate('administeredBy', 'name role')
        .sort({ administeredDate: -1 })
        .lean(),
      Session.find({ pet: pet._id, status: 'completed' })
        .populate('professional', 'name role')
        .populate({
          path: 'booking',
          populate: { path: 'service', select: 'type title' },
        })
        .sort({ endedAt: -1 })
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        pet,
        vaccinations,
        completedSessions: sessions,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Support Tickets & SOS
const createSupportTicket = async (req, res, next) => {
  try {
    const { type, priority, subject, notes, bookingId, sessionId, professionalId, attachments } =
      req.body;

    if (!type || !notes) {
      return res.status(400).json({
        success: false,
        message: 'Ticket type and notes are required.',
      });
    }

    const ticketNumber = `PJ-${Date.now().toString().slice(-6)}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    const ticket = await SupportTicket.create({
      ticketNumber,
      user: req.user._id,
      assignedRelationshipManager: req.user.profile?.assignedRelationshipManager || null,
      booking: bookingId || null,
      session: sessionId || null,
      professional: professionalId || null,
      type,
      priority: type === 'emergency_sos' ? 'critical' : priority || 'medium',
      status: 'open',
      subject: subject || type.replace(/_/g, ' ').toUpperCase(),
      notes: String(notes).trim(),
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    return res.status(201).json({
      success: true,
      message: 'Support ticket created.',
      data: { ticket },
    });
  } catch (err) {
    return next(err);
  }
};

const listSupportTickets = async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { user: req.user._id };
    const tickets = await SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      data: { tickets },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  arriveSession,
  startSession,
  completeSession,
  interruptOrDisputeSession,
  getSessionById,
  createSessionReview,
  createVaccinationRecord,
  getPetHealthRecords,
  createSupportTicket,
  listSupportTickets,
};