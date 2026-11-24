const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const Pet = require('../models/Pet');
const Service = require('../models/Service');
const Package = require('../models/Package');
const User = require('../models/User');
const ProfessionalProfile = require('../models/ProfessionalProfile');
const WalletTransaction = require('../models/WalletTransaction');
const SessionAuditLog = require('../models/SessionAuditLog');
const AppConfig = require('../models/AppConfig');

const SERVICE_TO_PRO_ROLE = {
  Training: 'trainer',
  Walking: 'walker',
  Grooming: 'groomer',
  Vaccination: 'vet',
};

const pickProfessionalForService = async (serviceType) => {
  const targetRole = SERVICE_TO_PRO_ROLE[serviceType] || 'trainer';
  let proProfile = await ProfessionalProfile.findOne({
    professionalRole: targetRole,
    verificationStatus: 'verified',
    isAvailable: true,
  }).sort({ averageRating: -1 });

  if (!proProfile) {
    const proUser = await User.findOne({
      role: { $in: [targetRole, 'trainer', 'walker', 'groomer', 'vet', 'paravet'] },
      accountStatus: 'active',
    });
    return proUser ? proUser._id : null;
  }
  return proProfile.user;
};

const pickCounsellor = async () => {
  const counsellor = await User.findOne({
    role: 'counsellor',
    accountStatus: 'active',
  }).select('_id');
  return counsellor ? counsellor._id : null;
};

const createBookingInternal = async ({
  userId,
  petId,
  packageId,
  scheduledDate,
  timeSlot,
  addressId,
  addressInput,
  isRecurring = false,
  forceAssessment = false,
}) => {
  const mongoSession = await mongoose.startSession();
  try {
    let createdBooking = null;
    let createdSessions = [];

    await mongoSession.withTransaction(async () => {
      const customer = await User.findById(userId).session(mongoSession);
      if (!customer) {
        const err = new Error('Customer not found.');
        err.statusCode = 404;
        throw err;
      }

      const pet = await Pet.findOne({ _id: petId, user: userId, isActive: true }).session(
        mongoSession
      );
      if (!pet) {
        const err = new Error('Selected pet not found for this account.');
        err.statusCode = 404;
        throw err;
      }

      const pkg = await Package.findOne({ _id: packageId, activeStatus: true }).session(
        mongoSession
      );
      if (!pkg) {
        const err = new Error('Selected package not found or inactive.');
        err.statusCode = 404;
        throw err;
      }

      const service = await Service.findById(pkg.service).session(mongoSession);
      if (!service || !service.activeStatus) {
        const err = new Error('Associated service is inactive.');
        err.statusCode = 404;
        throw err;
      }

      if (!pkg.species.includes(pet.species)) {
        const err = new Error(
          `Package "${pkg.name}" is not available for species "${pet.species}".`
        );
        err.statusCode = 400;
        throw err;
      }

      // Resolve address snapshot
      let resolvedAddress = null;
      if (addressId) {
        const foundAddr = customer.addresses.id(addressId);
        if (foundAddr) {
          resolvedAddress = foundAddr.toObject();
        }
      }
      if (!resolvedAddress && addressInput && addressInput.line1) {
        resolvedAddress = {
          label: addressInput.label || 'Home',
          line1: addressInput.line1,
          line2: addressInput.line2 || '',
          city: addressInput.city || 'Gurugram',
          state: addressInput.state || 'Haryana',
          pincode: addressInput.pincode || '122001',
          coordinates: addressInput.coordinates || { lat: null, lng: null },
        };
      }
      if (!resolvedAddress && customer.addresses.length > 0) {
        const defAddr =
          customer.addresses.find((a) => a.isDefault) || customer.addresses[0];
        resolvedAddress = defAddr.toObject();
      }
      if (!resolvedAddress) {
        resolvedAddress = {
          label: 'Home',
          line1: 'Sector 29, Gurugram',
          line2: '',
          city: 'Gurugram',
          state: 'Haryana',
          pincode: '122001',
          coordinates: { lat: 28.4694, lng: 77.0648 },
        };
      }

      const isFreeDemo = Boolean(forceAssessment || pkg.freeDemoEligible || Number(pkg.price) === 0);
      const sessionCount = isFreeDemo ? 1 : Number(pkg.sessionCount || 1);
      const totalAmount = isFreeDemo ? 0 : Number(pkg.price || 0);
      const perSessionAmount =
        sessionCount > 0 ? Number((totalAmount / sessionCount).toFixed(2)) : 0;
      const perSessionPayoutAmount = Number(pkg.trainerPayoutPerSession || 0);

      // Validate sufficient client wallet balance upfront before confirming paid booking
      if (totalAmount > 0 && Number(customer.walletBalance || 0) < totalAmount) {
        const err = new Error(
          `Insufficient wallet balance. Required: INR ${totalAmount}, Available: INR ${Number(
            customer.walletBalance || 0
          )}. Please contact Admin/Support to add wallet balance.`
        );
        err.statusCode = 400;
        err.code = 'INSUFFICIENT_WALLET_BALANCE';
        throw err;
      }

      const assignedProId = await pickProfessionalForService(service.type);
      if (!assignedProId) {
        const err = new Error(`No active ${service.type} professional available right now.`);
        err.statusCode = 409;
        throw err;
      }

      const assignedCounsellorId =
        service.type === 'Training' ? await pickCounsellor() : null;

      const bookingType = isFreeDemo
        ? 'free_assessment'
        : sessionCount > 1
        ? 'multi_session_package'
        : 'single_session';

      const baseDate = scheduledDate ? new Date(scheduledDate) : new Date(Date.now() + 86400000);
      if (Number.isNaN(baseDate.getTime())) {
        const err = new Error('Invalid scheduledDate.');
        err.statusCode = 400;
        throw err;
      }

      const [bookingDoc] = await Booking.create(
        [
          {
            user: customer._id,
            pet: pet._id,
            service: service._id,
            package: pkg._id,
            assignedProfessional: assignedProId,
            assignedCounsellor: assignedCounsellorId,
            bookingType,
            totalAmount,
            perSessionAmount,
            perSessionPayoutAmount,
            addressSnapshot: resolvedAddress,
            scheduledDate: baseDate,
            timeSlot: String(timeSlot || '10:00 AM - 11:00 AM').trim(),
            isRecurring: Boolean(isRecurring),
            status: 'upcoming',
            arrivalStatus: 'pending',
            serviceCompletionStatus: 'not_started',
            totalSessionCount: sessionCount,
            completedSessionCount: 0,
            sessionIds: [],
          },
        ],
        { session: mongoSession }
      );

      const sessionPayloads = [];
      for (let i = 0; i < sessionCount; i += 1) {
        const sessionDate = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000);
        sessionPayloads.push({
          booking: bookingDoc._id,
          sessionNumber: i + 1,
          professional: assignedProId,
          customer: customer._id,
          pet: pet._id,
          sessionAmount: perSessionAmount,
          professionalPayoutAmount: perSessionPayoutAmount,
          walletSettled: false,
          scheduledDate: sessionDate,
          scheduledDurationMinutes: Number(pkg.sessionDuration || service.sessionDuration || 45),
          status: 'scheduled',
          arrivalVerificationStatus: 'pending',
        });
      }

      createdSessions = await Session.insertMany(sessionPayloads, { session: mongoSession });
      bookingDoc.sessionIds = createdSessions.map((s) => s._id);
      await bookingDoc.save({ session: mongoSession });

      for (const s of createdSessions) {
        await SessionAuditLog.create(
          [
            {
              session: s._id,
              booking: bookingDoc._id,
              actor: customer._id,
              actorRole: customer.role,
              action: 'SESSION_SCHEDULED',
              previousStatus: null,
              newStatus: 'scheduled',
              timestamp: new Date(),
              metadata: {
                bookingType,
                sessionAmount: s.sessionAmount,
                professionalPayoutAmount: s.professionalPayoutAmount,
              },
            },
          ],
          { session: mongoSession }
        );
      }

      createdBooking = bookingDoc;
    });

    const populatedBooking = await Booking.findById(createdBooking._id)
      .populate('pet', 'name species breed age gender photos')
      .populate('service', 'type code title sessionDuration')
      .populate('package', 'name sessionCount sessionDuration price freeDemoEligible')
      .populate('assignedProfessional', 'name phone role')
      .populate('assignedCounsellor', 'name phone role')
      .lean();

    return {
      booking: populatedBooking,
      sessions: createdSessions,
    };
  } finally {
    await mongoSession.endSession();
  }
};

const bookAssessment = async (req, res, next) => {
  try {
    const { petId, packageId, scheduledDate, timeSlot, addressId, addressInput } = req.body;
    if (!petId) {
      return res.status(400).json({ success: false, message: 'petId is required.' });
    }

    let resolvedPackageId = packageId;
    if (!resolvedPackageId) {
      const trainingService = await Service.findOne({ type: 'Training', activeStatus: true }).lean();
      if (trainingService) {
        const demoPkg = await Package.findOne({
          service: trainingService._id,
          freeDemoEligible: true,
          activeStatus: true,
        }).lean();
        if (demoPkg) resolvedPackageId = demoPkg._id;
      }
    }

    if (!resolvedPackageId) {
      return res.status(400).json({
        success: false,
        message: 'No assessment/demo package found.',
      });
    }

    const result = await createBookingInternal({
      userId: req.user._id,
      petId,
      packageId: resolvedPackageId,
      scheduledDate,
      timeSlot,
      addressId,
      addressInput,
      forceAssessment: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Assessment / demo booking confirmed.',
      data: result,
    });
  } catch (err) {
    return next(err);
  }
};

const createBooking = async (req, res, next) => {
  try {
    const { petId, packageId, scheduledDate, timeSlot, addressId, addressInput, isRecurring } =
      req.body;

    if (!petId || !packageId) {
      return res.status(400).json({
        success: false,
        message: 'petId and packageId are required.',
      });
    }

    const result = await createBookingInternal({
      userId: req.user._id,
      petId,
      packageId,
      scheduledDate,
      timeSlot,
      addressId,
      addressInput,
      isRecurring,
      forceAssessment: false,
    });

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully.',
      data: result,
    });
  } catch (err) {
    return next(err);
  }
};

const getBookings = async (req, res, next) => {
  try {
    const filter = {};
    if (req.user.role === 'admin') {
      if (req.query.userId) filter.user = req.query.userId;
    } else if (
      ['walker', 'trainer', 'groomer', 'vet', 'paravet', 'counsellor', 'relationship_manager'].includes(
        req.user.role
      )
    ) {
      filter.assignedProfessional = req.user._id;
    } else {
      filter.user = req.user._id;
    }

    if (req.query.status && ['upcoming', 'active', 'completed', 'cancelled'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const bookings = await Booking.find(filter)
      .populate('user', 'name phone')
      .populate('pet', 'name species breed age gender photos')
      .populate('service', 'type code title sessionDuration')
      .populate('package', 'name sessionCount sessionDuration price')
      .populate('assignedProfessional', 'name phone role')
      .populate('assignedCounsellor', 'name phone role')
      .populate({
        path: 'sessionIds',
        options: { sort: { sessionNumber: 1 } },
      })
      .sort({ scheduledDate: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: { bookings },
    });
  } catch (err) {
    return next(err);
  }
};

const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id)
      .populate('user', 'name phone')
      .populate('pet', 'name species breed age gender photos medicalHistory behaviourSummary')
      .populate('service', 'type code title sessionDuration features syllabusOrInclusions')
      .populate('package', 'name sessionCount sessionDuration price trainerPayoutPerSession')
      .populate('assignedProfessional', 'name phone role')
      .populate('assignedCounsellor', 'name phone role')
      .populate({
        path: 'sessionIds',
        options: { sort: { sessionNumber: 1 } },
      })
      .lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const isOwner = booking.user?._id?.toString() === req.user._id.toString();
    const isAssignedPro =
      booking.assignedProfessional?._id?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssignedPro && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking.' });
    }

    const settlementTransactions = await WalletTransaction.find({
      booking: booking._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        booking,
        settlementTransactions,
      },
    });
  } catch (err) {
    return next(err);
  }
};

const cancelBooking = async (req, res, next) => {
  const mongoSession = await mongoose.startSession();
  try {
    const { id } = req.params;
    const { reason = '', noShowType = 'none' } = req.body;

    let responsePayload = null;

    await mongoSession.withTransaction(async () => {
      const booking = await Booking.findById(id).session(mongoSession);
      if (!booking) {
        const err = new Error('Booking not found.');
        err.statusCode = 404;
        throw err;
      }

      const isOwner = booking.user.toString() === req.user._id.toString();
      const isAssignedPro =
        booking.assignedProfessional &&
        booking.assignedProfessional.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAssignedPro && !isAdmin) {
        const err = new Error('Not authorized to cancel this booking.');
        err.statusCode = 403;
        throw err;
      }

      if (booking.status === 'cancelled') {
        const err = new Error('Booking is already cancelled.');
        err.statusCode = 400;
        throw err;
      }

      if (booking.status === 'completed') {
        const err = new Error('Completed bookings cannot be cancelled.');
        err.statusCode = 400;
        throw err;
      }

      // Dynamic cancellation fee calculation: within 6 hours of scheduledDate, 20% of remaining unsettled amount
      const hoursUntilSchedule =
        (new Date(booking.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60);
      const remainingSessions = Math.max(0, booking.totalSessionCount - booking.completedSessionCount);
      const remainingValue = Number((remainingSessions * booking.perSessionAmount).toFixed(2));

      const cfg = await AppConfig.findOne({ configKey: 'GLOBAL_CONFIG' })
      .select('operationalRules')
      .session(mongoSession)
      .lean();
      const freeWindowHours = Number(cfg?.operationalRules?.cancellationFreeWindowHours ?? 6);
      const feePercent = Number(cfg?.operationalRules?.cancellationFeePercentage ?? 20);

      let cancellationFee = 0;
      if (
        !isAdmin &&
        !isAssignedPro &&
        hoursUntilSchedule < freeWindowHours &&
        remainingValue > 0 &&
        noShowType !== 'professional_no_show'
      ) {
          cancellationFee = Number(((remainingValue * feePercent) / 100).toFixed(2));
      }

      const customer = await User.findById(booking.user).session(mongoSession);
      let feeTransaction = null;

      if (cancellationFee > 0 && customer && customer.walletBalance >= cancellationFee) {
        const beforeBal = Number(customer.walletBalance || 0);
        const afterBal = Number((beforeBal - cancellationFee).toFixed(2));
        customer.walletBalance = afterBal;
        await customer.save({ session: mongoSession });

        const [tx] = await WalletTransaction.create(
          [
            {
              user: customer._id,
              role: 'client',
              type: 'debit',
              category: 'adjustment',
              amount: cancellationFee,
              balanceBefore: beforeBal,
              balanceAfter: afterBal,
              booking: booking._id,
              performedBy: req.user._id,
              description: `Late cancellation fee (${reason || 'Cancelled within window'})`,
              metadata: { note: reason },
              referenceId: `CANCEL_FEE_${booking._id}_${Date.now()}`,
            },
          ],
          { session: mongoSession }
        );
        feeTransaction = tx;
      }

      booking.status = 'cancelled';
      booking.cancellationDetails = {
        cancelledBy: req.user._id,
        cancelledAt: new Date(),
        reason,
        cancellationFee,
        noShowType,
      };
      booking.refundStatus = cancellationFee > 0 ? 'forfeited' : 'not_applicable';
      if (noShowType === 'professional_no_show') {
        booking.makeUpSessionStatus = 'eligible';
      }
      await booking.save({ session: mongoSession });

      const unsettledSessions = await Session.find({
        booking: booking._id,
        status: { $nin: ['completed', 'cancelled'] },
      }).session(mongoSession);

      for (const s of unsettledSessions) {
        const prev = s.status;
        s.status = 'cancelled';
        await s.save({ session: mongoSession });

        await SessionAuditLog.create(
          [
            {
              session: s._id,
              booking: booking._id,
              actor: req.user._id,
              actorRole: req.user.role,
              action: 'SESSION_CANCELLED',
              previousStatus: prev,
              newStatus: 'cancelled',
              timestamp: new Date(),
              metadata: { reason, cancellationFee, noShowType },
            },
          ],
          { session: mongoSession }
        );
      }

      responsePayload = {
        booking,
        cancellationFee,
        feeTransaction,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled.',
      data: responsePayload,
    });
  } catch (err) {
    return next(err);
  } finally {
    await mongoSession.endSession();
  }
};

module.exports = {
  bookAssessment,
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
};