const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  team: { type: String, required: true, enum: ['dev', 'mkt'] },
  seat_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat', default: null },
  active: { type: Boolean, default: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: false } });

module.exports = mongoose.model('User', userSchema);
