const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
      required: true,
    },
    assignedProfessional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedCounsellor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bookingType: {
      type: String,
      enum: ['free_assessment', 'single_session', 'multi_session_package', 'replacement_session'],
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    perSessionAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    perSessionPayoutAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    addressSnapshot: {
      label: { type: String, default: 'Home' },
      line1: { type: String, required: true },
      line2: { type: String, default: '' },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['upcoming', 'active', 'completed', 'cancelled'],
      default: 'upcoming',
      index: true,
    },
    cancellationDetails: {
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      cancelledAt: { type: Date, default: null },
      reason: { type: String, default: '' },
      cancellationFee: { type: Number, default: 0, min: 0 },
      noShowType: {
        type: String,
        enum: ['none', 'customer_no_show', 'professional_no_show', 'disputed'],
        default: 'none',
      },
    },
    refundStatus: {
      type: String,
      enum: ['not_applicable', 'pending', 'refunded', 'forfeited'],
      default: 'not_applicable',
    },
    makeUpSessionStatus: {
      type: String,
      enum: ['none', 'eligible', 'scheduled', 'completed'],
      default: 'none',
    },
    arrivalStatus: {
      type: String,
      enum: ['pending', 'arrived', 'verified'],
      default: 'pending',
    },
    serviceCompletionStatus: {
      type: String,
      enum: ['not_started', 'in_progress', 'partial', 'completed'],
      default: 'not_started',
    },
    reviewEligibility: {
      type: Boolean,
      default: false,
    },
    sessionIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Session',
      default: [],
    },
    completedSessionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSessionCount: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ user: 1, status: 1, scheduledDate: -1 });
bookingSchema.index({ assignedProfessional: 1, status: 1, scheduledDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);