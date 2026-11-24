const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const USER_ROLES = [
  'pet_parent',
  'walker',
  'trainer',
  'groomer',
  'vet',
  'paravet',
  'counsellor',
  'relationship_manager',
  'admin',
];

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    coordinates: {
      lat: { type: Number, min: -90, max: 90, default: null },
      lng: { type: Number, min: -180, max: 180, default: null },
    },
    isDefault: { type: Boolean, default: false },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'pet_parent',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      match: [/^[0-9]{10,15}$/, 'Please provide a valid mobile number (10-15 digits)'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    walletBalance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
    },
    registrationCode: {
      type: String,
      default: null,
      select: false,
    },
    registrationCodeExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    addresses: {
      type: [addressSchema],
      default: [],
    },
    profile: {
      avatarUrl: { type: String, default: '' },
      bio: { type: String, maxlength: 500, default: '' },
      emergencyContactName: { type: String, default: '' },
      emergencyContactPhone: { type: String, default: '' },
      assignedRelationshipManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      notificationPreferences: {
        pushEnabled: { type: Boolean, default: true },
        sessionAlerts: { type: Boolean, default: true },
        walletAlerts: { type: Boolean, default: true },
        vaccinationReminders: { type: Boolean, default: true },
      },
      privacySettings: {
        shareLiveLocationWithRm: { type: Boolean, default: true },
        showPhoneToAssignedPro: { type: Boolean, default: true },
      },
    },
    accountStatus: {
      type: String,
      enum: ['pending_verification', 'active', 'suspended', 'deleted'],
      default: 'pending_verification',
      index: true,
    },
    authenticationMetadata: {
      lastLoginAt: { type: Date, default: null },
      lastLoginIp: { type: String, default: '' },
      refreshTokenHash: { type: String, default: null, select: false },
      refreshTokenExpiresAt: { type: Date, default: null, select: false },
      deletedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1, accountStatus: 1 });

userSchema.pre('save', async function hashPasswordHook() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function matchPassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
module.exports.USER_ROLES = USER_ROLES;