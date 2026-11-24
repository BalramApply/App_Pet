const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['client', 'professional'],
      required: true,
    },
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true,
    },
    category: {
      type: String,
      enum: ['admin_topup', 'session_payment', 'session_earning', 'refund', 'adjustment'],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Transaction amount must be non-negative'],
    },
    balanceBefore: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },
    metadata: {
      petName: { type: String, default: '' },
      serviceName: { type: String, default: '' },
      note: { type: String, default: '' },
    },
    referenceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ category: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);