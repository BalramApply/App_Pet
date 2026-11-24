const mongoose = require('mongoose');

// One row per admin write request (POST/PUT/PATCH/DELETE), written by middleware/adminAudit.js
const adminAuditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actorName: { type: String, default: '' },
    method: { type: String, required: true },
    path: { type: String, required: true },
    // Path with ids replaced by ":id", e.g. "PUT /api/admin/users/:id"
    action: { type: String, required: true, index: true },
    targetId: { type: String, default: '', index: true },
    statusCode: { type: Number, default: 0 },
    success: { type: Boolean, default: false, index: true },
    requestBody: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

adminAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AdminAuditLog', adminAuditLogSchema);