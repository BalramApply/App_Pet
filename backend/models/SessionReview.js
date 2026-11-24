const mongoose = require('mongoose');

const sessionReviewSchema = new mongoose.Schema(
  {
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    professional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    criteria: {
      punctuality: { type: Number, min: 1, max: 5, default: 5 },
      petCare: { type: Number, min: 1, max: 5, default: 5 },
      communication: { type: Number, min: 1, max: 5, default: 5 },
    },
    reviewText: {
      type: String,
      maxlength: 1200,
      trim: true,
      default: '',
    },
    moderationStatus: {
      type: String,
      enum: ['published', 'flagged', 'hidden'],
      default: 'published',
      index: true,
    },
    reportedAt: {
      type: Date,
      default: null,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

sessionReviewSchema.index({ session: 1, customer: 1 }, { unique: true });
sessionReviewSchema.index({ professional: 1, moderationStatus: 1, createdAt: -1 });

module.exports = mongoose.model('SessionReview', sessionReviewSchema);