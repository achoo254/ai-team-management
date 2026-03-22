const router = require('express').Router();
const Team = require('../models/team-model');
const User = require('../models/user-model');
const Seat = require('../models/seat-model');
const { authenticate, requireAdmin, validateObjectId } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/teams — list all teams
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find().sort({ _id: 1 }).lean();

    const userCounts = await User.aggregate([
      { $group: { _id: '$team', count: { $sum: 1 } } },
    ]);
    const seatCounts = await Seat.aggregate([
      { $group: { _id: '$team', count: { $sum: 1 } } },
    ]);

    const ucMap = Object.fromEntries(userCounts.map(u => [u._id, u.count]));
    const scMap = Object.fromEntries(seatCounts.map(s => [s._id, s.count]));

    const result = teams.map(t => ({
      ...t,
      id: t._id,
      user_count: ucMap[t.name] || 0,
      seat_count: scMap[t.name] || 0,
    }));

    res.json({ teams: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams — create team (admin only)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, label, color } = req.body;
    if (!name || !label) return res.status(400).json({ error: 'name, label required' });
    const team = await Team.create({ name: name.toLowerCase(), label, color: color || '#3b82f6' });
    res.status(201).json({ team: { ...team.toObject(), id: team._id } });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Tên team đã tồn tại' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/teams/:id — update team (admin only)
router.put('/:id', requireAdmin, validateObjectId, async (req, res) => {
  try {
    const { label, color } = req.body;
    const update = {};
    if (label) update.label = label;
    if (color) update.color = color;
    const team = await Team.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!team) return res.status(404).json({ error: 'Team not found' });
    res.json({ team: { ...team, id: team._id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:id — delete team (admin only, must have no users/seats)
router.delete('/:id', requireAdmin, validateObjectId, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).lean();
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const userCount = await User.countDocuments({ team: team.name });
    const seatCount = await Seat.countDocuments({ team: team.name });
    if (userCount > 0 || seatCount > 0) {
      return res.status(400).json({ error: `Không thể xoá: còn ${userCount} user và ${seatCount} seat thuộc team này` });
    }

    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
