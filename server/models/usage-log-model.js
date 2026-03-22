const mongoose = require('mongoose');

const usageLogSchema = new mongoose.Schema({
  seat_email: { type: String, required: true },
  week_start: { type: String, required: true },
  weekly_all_pct: { type: Number, default: 0 },
  weekly_sonnet_pct: { type: Number, default: 0 },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  logged_at: { type: Date, default: Date.now },
});

// Compound unique index matching SQLite UNIQUE(seat_email, week_start, user_id)
usageLogSchema.index({ seat_email: 1, week_start: 1, user_id: 1 }, { unique: true });
// Performance index
usageLogSchema.index({ seat_email: 1, week_start: 1 });

module.exports = mongoose.model('UsageLog', usageLogSchema);
