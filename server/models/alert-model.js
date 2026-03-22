const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  seat_email: { type: String, required: true },
  type: { type: String, required: true, enum: ['high_usage', 'no_activity'] },
  message: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  resolved_by: { type: String, default: null },
  resolved_at: { type: Date, default: null },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

alertSchema.index({ resolved: 1 });

module.exports = mongoose.model('Alert', alertSchema);
