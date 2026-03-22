const router = require('express').Router();
const User = require('../models/user-model');
const { authenticate, requireAdmin, validateObjectId } = require('../middleware/auth-middleware');
const { checkAlerts } = require('../services/alert-service');
const { sendWeeklyReport } = require('../services/telegram-service');

router.use(authenticate, requireAdmin);

// POST /api/admin/check-alerts — manually trigger alert check
router.post('/check-alerts', async (req, res) => {
  try {
    const result = await checkAlerts();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find()
      .populate('seat_id', 'label email')
      .sort({ team: 1, name: 1 })
      .lean();

    const result = users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      team: u.team,
      seat_id: u.seat_id?._id || null,
      active: u.active,
      seat_label: u.seat_id?.label || null,
      seat_email: u.seat_id?.email || null,
    }));

    res.json({ users: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/send-report — trigger Telegram weekly report (rate limited: 1 per 60s)
let lastReportSent = 0;
router.post('/send-report', async (req, res) => {
  const now = Date.now();
  if (now - lastReportSent < 60000) {
    const wait = Math.ceil((60000 - (now - lastReportSent)) / 1000);
    return res.status(429).json({ error: `Vui lòng chờ ${wait}s trước khi gửi lại` });
  }
  try {
    await sendWeeklyReport();
    lastReportSent = Date.now();
    res.json({ message: 'Đã gửi báo cáo qua Telegram' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/admin/users/bulk-active — set active for all users
router.patch('/users/bulk-active', async (req, res) => {
  try {
    const { active } = req.body;
    if (active === undefined) return res.status(400).json({ error: 'active required' });
    const result = await User.updateMany({ _id: { $ne: req.user.id } }, { active: !!active });
    if (!active) await User.findByIdAndUpdate(req.user.id, { active: true });
    res.json({ message: 'Updated', count: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users
router.post('/users', async (req, res) => {
  try {
    const { name, email, role = 'user', team, seatId } = req.body;
    if (!name || !email || !team) {
      return res.status(400).json({ error: 'name, email, team required' });
    }
    const user = await User.create({ name, email, role, team, seat_id: seatId || null });
    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, team: user.team, seat_id: user.seat_id },
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', validateObjectId, async (req, res) => {
  try {
    const { name, email, role, team, seatId, active } = req.body;
    const update = {};
    if (name) update.name = name;
    if (email) update.email = email;
    if (role) update.role = role;
    if (team) update.team = team;
    if (seatId !== undefined) update.seat_id = seatId || null;
    if (active !== undefined) {
      if (!active && String(req.params.id) === String(req.user.id)) {
        return res.status(400).json({ error: 'Không thể tự tắt tài khoản của mình' });
      }
      update.active = !!active;
    }
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No fields to update' });

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true })
      .select('name email role team seat_id active').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user._id, ...user } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', validateObjectId, async (req, res) => {
  try {
    const result = await User.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
