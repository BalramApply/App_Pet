const mongoose = require('mongoose');

const coordinatePointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const mediaItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, default: '' },
    mediaType: { type: String, enum: ['photo', 'video', 'certificate'], default: 'photo' },
    tag: { type: String, enum: ['before', 'after', 'progress', 'general'], default: 'general' },
    caption: { type: String, maxlength: 250, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const checklistItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    completed: { type: Boolean, default: false },
    notes: { type: String, maxlength: 300, default: '' },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    sessionNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    professional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customer: {
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
    sessionAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    professionalPayoutAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    walletSettled: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    walletSettledAt: {
      type: Date,
      default: null,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    scheduledDurationMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 300,
    },
    actualDurationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    coordinates: {
      type: [coordinatePointSchema],
      default: [],
    },
    latestLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    distanceCovered: {
      type: Number,
      default: 0,
      min: 0,
    },
    arrivalAt: {
      type: Date,
      default: null,
    },
    arrivalVerificationStatus: {
      type: String,
      enum: ['pending', 'arrived', 'verified'],
      default: 'pending',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    scheduledEndAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: [
        'scheduled',
        'professional_arrived',
        'in_progress',
        'duration_completed',
        'completed',
        'interrupted',
        'disputed',
        'cancelled',
      ],
      default: 'scheduled',
      index: true,
    },
    reportNotes: {
      type: String,
      maxlength: 2000,
      default: '',
    },
    completionNotes: {
      type: String,
      maxlength: 2000,
      default: '',
    },
    completionConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    completionConfirmedAt: {
      type: Date,
      default: null,
    },
    media: {
      type: [mediaItemSchema],
      default: [],
    },
    checklist: {
      type: [checklistItemSchema],
      default: [],
    },
    behaviorScores: {
      obedience: { type: Number, min: 0, max: 10, default: null },
      leashControl: { type: Number, min: 0, max: 10, default: null },
      socialization: { type: Number, min: 0, max: 10, default: null },
      calmness: { type: Number, min: 0, max: 10, default: null },
      overallProgressScore: { type: Number, min: 0, max: 100, default: null },
    },
    reviewEligible: {
      type: Boolean,
      default: false,
    },
    review: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SessionReview',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ booking: 1, sessionNumber: 1 }, { unique: true });
sessionSchema.index({ professional: 1, status: 1 });
sessionSchema.index({ customer: 1, status: 1 });

module.exports = mongoose.model('Session', sessionSchema);