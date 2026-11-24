const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    categoryTag: {
      type: String,
      trim: true,
      default: 'General',
    },
    species: {
      type: [String],
      enum: ['dog', 'cat'],
      required: true,
    },
    lifeStage: {
      type: String,
      enum: ['all', 'puppy_kitten', 'adult', 'senior'],
      default: 'all',
    },
    sessionCount: {
      type: Number,
      required: true,
      min: 1,
      max: 120,
    },
    sessionDuration: {
      type: Number,
      required: true,
      min: 10,
      max: 240,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    trainerPayoutPerSession: {
      type: Number,
      required: true,
      min: 0,
    },
    freeDemoEligible: {
      type: Boolean,
      default: false,
    },
    inclusions: {
      type: [String],
      default: [],
    },
    vaccineDetails: {
      vaccineName: { type: String, default: '' },
      doseCount: { type: Number, default: 1 },
      boosterIntervalDays: { type: Number, default: 365 },
    },
    activeStatus: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

packageSchema.index({ service: 1, activeStatus: 1 });

module.exports = mongoose.model('Package', packageSchema);