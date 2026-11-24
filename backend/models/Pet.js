const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Pet name is required'],
      trim: true,
      maxlength: 60,
    },
    species: {
      type: String,
      enum: ['dog', 'cat'],
      required: true,
      index: true,
    },
    breed: {
      type: String,
      required: [true, 'Breed is required'],
      trim: true,
      maxlength: 80,
    },
    age: {
      years: { type: Number, min: 0, max: 30, default: 0 },
      months: { type: Number, min: 0, max: 11, default: 0 },
      lifeStage: { type: String, enum: ['puppy_kitten', 'adult', 'senior'], default: 'adult' },
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true,
    },
    weightKg: {
      type: Number,
      min: 0.2,
      max: 150,
      default: null,
    },
    neuteredOrSpayed: {
      type: Boolean,
      default: false,
    },
    medicalHistory: {
      allergies: { type: [String], default: [] },
      conditions: { type: [String], default: [] },
      vetClinicName: { type: String, default: '' },
      microchipId: { type: String, default: '' },
      notes: { type: String, maxlength: 1000, default: '' },
    },
    behaviourSummary: {
      temperament: { type: String, default: '' },
      trainingLevel: { type: String, default: 'Beginner' },
      latestBehaviorScore: { type: Number, min: 0, max: 100, default: null },
    },
    photos: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

petSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model('Pet', petSchema);