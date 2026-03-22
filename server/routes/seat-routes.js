const router = require('express').Router();
const Seat = require('../models/seat-model');
const User = require('../models/user-model');
const Schedule = require('../models/schedule-model');
const { authenticate, requireAdmin, validateObjectId } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/seats
router.get('/', async (req, res) => {
  try {
    const seats = await Seat.find().sort({ _id: 1 }).lean();
    const users = await User.find({ active: true, seat_id: { $ne: null } }, 'name email seat_id').lean();

    const usersBySeat = {};
    for (const u of users) {
      const key = String(u.seat_id);
      if (!usersBySeat[key]) usersBySeat[key] = [];
      usersBySeat[key].push({ id: u._id, name: u.name, email: u.email });
    }

    const result = seats.map(s => ({
      ...s,
      id: s._id,
      users: usersBySeat[String(s._id)] || [],
    }));

    res.json({ seats: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seats — create a new seat
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, label, team, max_users } = req.body;
    if (!email || !label || !team) return res.status(400).json({ error: 'email, label, team required' });
    const seat = await Seat.create({ email, label, team, max_users: max_users || 3 });
    res.status(201).json({ seat: { ...seat.toObject(), id: seat._id } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email đã tồn tại' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/seats/:id
router.put('/:id', requireAdmin, validateObjectId, async (req, res) => {
  try {
    const { label, team, max_users } = req.body;
    const update = {};
    if (label) update.label = label;
    if (team) update.team = team;
    if (max_users !== undefined) update.max_users = max_users;
    const seat = await Seat.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!seat) return res.status(404).json({ error: 'Seat not found' });
    res.json({ seat: { ...seat, id: seat._id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/seats/:id — delete a seat (unassign users + clear schedules)
router.delete('/:id', requireAdmin, validateObjectId, async (req, res) => {
  try {
    await User.updateMany({ seat_id: req.params.id }, { seat_id: null });
    await Schedule.deleteMany({ seat_id: req.params.id });
    await Seat.findByIdAndDelete(req.params.id);
    res.json({ message: 'Seat deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seats/:id/assign
router.post('/:id/assign', requireAdmin, validateObjectId, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await User.findByIdAndUpdate(userId, { seat_id: req.params.id });
    res.json({ message: 'User assigned to seat' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/seats/:id/unassign/:userId
router.delete('/:id/unassign/:userId', requireAdmin, validateObjectId, async (req, res) => {
  try {
    await User.findOneAndUpdate(
      { _id: req.params.userId, seat_id: req.params.id },
      { seat_id: null }
    );
    await Schedule.deleteMany({ seat_id: req.params.id, user_id: req.params.userId });
    res.json({ message: 'User removed from seat and schedules cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
