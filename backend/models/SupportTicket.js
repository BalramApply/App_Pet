const mongoose = require('mongoose');

// One entry in a ticket conversation. internal=true notes are visible to admins only.
const ticketMessageSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorRole: { type: String, required: true },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
  internal: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    assignedRelationshipManager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      default: null,
    },
    professional: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: [
        'callback_request',
        'email_inquiry',
        'complaint',
        'reschedule_request',
        'wallet_billing_inquiry',
        'concern_report',
        'emergency_sos',
      ],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    notes: {
      type: String,
      required: true,
      maxlength: 2500,
      trim: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    // select:false keeps internal notes out of every existing query (including the
    // app's own ticket list). Read it explicitly with .select('+messages').
    messages: {
      type: [ticketMessageSchema],
      default: [],
      select: false,
    },
    lastStaffReplyAt: { type: Date, default: null },
    lastUserReplyAt: { type: Date, default: null },
    userLastReadAt: { type: Date, default: null },
    resolution: {
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      resolvedAt: { type: Date, default: null },
      summary: { type: String, maxlength: 1500, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

supportTicketSchema.index({ user: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);