const mongoose = require('mongoose');

const vaccinationRecordSchema = new mongoose.Schema(
  {
    pet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pet',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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
    vaccineName: {
      type: String,
      required: true,
      trim: true,
    },
    vaccineCode: {
      type: String,
      trim: true,
      default: '',
    },
    doseNumber: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    batchNumber: {
      type: String,
      trim: true,
      default: '',
    },
    administeredDate: {
      type: Date,
      required: true,
      index: true,
    },
    nextDueDate: {
      type: Date,
      default: null,
      index: true,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    certificateUrl: {
      type: String,
      default: '',
    },
    administeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    clinicOrHomeNotes: {
      type: String,
      maxlength: 1000,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

vaccinationRecordSchema.index({ pet: 1, administeredDate: -1 });

module.exports = mongoose.model('VaccinationRecord', vaccinationRecordSchema);