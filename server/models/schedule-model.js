const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  seat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  day_of_week: { type: Number, required: true, min: 0, max: 6 },
  slot: { type: String, required: true, enum: ['morning', 'afternoon'] },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

// Compound unique: one user per seat per day+slot
scheduleSchema.index({ seat_id: 1, day_of_week: 1, slot: 1 }, { unique: true });
// Query performance
scheduleSchema.index({ seat_id: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
