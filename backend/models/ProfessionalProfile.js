const mongoose = require('mongoose');

const credentialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    issuingBody: { type: String, required: true, trim: true },
    credentialNumber: { type: String, trim: true, default: '' },
    documentUrl: { type: String, trim: true, default: '' },
    issuedDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    verified: { type: Boolean, default: false },
  },
  { _id: true }
);

const serviceAreaSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    locality: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    radiusKm: { type: Number, default: 10, min: 1, max: 100 },
  },
  { _id: false }
);

const professionalProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    professionalRole: {
      type: String,
      enum: ['walker', 'trainer', 'groomer', 'vet', 'paravet', 'counsellor', 'relationship_manager'],
      required: true,
      index: true,
    },
    profilePhoto: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      maxlength: 1000,
      default: '',
    },
    experienceYears: {
      type: Number,
      min: 0,
      max: 60,
      default: 0,
    },
    specializations: {
      type: [String],
      default: [],
    },
    qualifications: {
      type: [String],
      default: [],
    },
    credentials: {
      type: [credentialSchema],
      default: [],
    },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'expired'],
      default: 'pending',
      index: true,
    },
    verificationNotes: {
      type: String,
      default: '',
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    serviceAreas: {
      type: [serviceAreaSchema],
      default: [],
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalEligibleReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAssignedSessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCompletedSessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalCancelledSessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

professionalProfileSchema.index({ professionalRole: 1, verificationStatus: 1, isAvailable: 1 });

module.exports = mongoose.model('ProfessionalProfile', professionalProfileSchema);