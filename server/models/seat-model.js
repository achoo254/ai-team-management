const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  team: { type: String, required: true, enum: ['dev', 'mkt'] },
  max_users: { type: Number, default: 3 },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('Seat', seatSchema);
