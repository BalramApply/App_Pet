const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      required: true,
      unique: true,
      default: 'GLOBAL_CONFIG',
    },
    supportContact: {
      supportPhone: { type: String, required: true, trim: true },
      supportWhatsApp: { type: String, required: true, trim: true },
      supportEmail: { type: String, required: true, trim: true },
      supportHours: { type: String, required: true, trim: true },
      emergencyHelpline: { type: String, required: true, trim: true },
    },
    operationalRules: {
      registrationCodeExpiryMinutes: { type: Number, default: 10 },
      cancellationFreeWindowHours: { type: Number, default: 6 },
      cancellationFeePercentage: { type: Number, default: 20 },
      defaultTrainerPayoutPercentage: { type: Number, default: 75 },
    },
    policyDocuments: {
      cancellationPolicy: { type: String, default: '' },
      walletPolicy: { type: String, default: '' },
      privacyPolicy: { type: String, default: '' },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AppConfig', appConfigSchema);