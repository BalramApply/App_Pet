const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Training', 'Walking', 'Grooming', 'Vaccination'],
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    targetSpecies: {
      type: [String],
      enum: ['dog', 'cat'],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    syllabusOrInclusions: {
      type: [String],
      default: [],
    },
    features: {
      type: [String],
      default: [],
    },
    sessionDuration: {
      type: Number,
      required: true,
      min: 10,
      max: 240,
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

module.exports = mongoose.model('Service', serviceSchema);