const router = require('express').Router();
const User = require('../models/user-model');
const UsageLog = require('../models/usage-log-model');
const { authenticate } = require('../middleware/auth-middleware');
const { logUsage, getCurrentWeekStart } = require('../services/usage-sync-service');

router.use(authenticate);

// POST /api/usage-log — log weekly usage percentages
router.post('/', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('seat_id', 'email').lean();
    if (!user || !user.seat_id) return res.status(400).json({ error: 'User has no assigned seat' });

    const { weekStart, weeklyAllPct, weeklySonnetPct } = req.body;
    const week = weekStart || getCurrentWeekStart();
    const allPct = Math.max(0, Math.min(100, parseInt(weeklyAllPct) || 0));
    const sonnetPct = Math.max(0, Math.min(100, parseInt(weeklySonnetPct) || 0));

    // Validate weekStart is a Monday (ISO day 1)
    const weekDate = new Date(week + 'T00:00:00');
    if (isNaN(weekDate.getTime()) || weekDate.getDay() !== 1) {
      return res.status(400).json({ error: 'weekStart phải là ngày thứ Hai (YYYY-MM-DD)' });
    }

    const result = await logUsage({
      seatEmail: user.seat_id.email,
      userId: user._id,
      weekStart: week,
      weeklyAllPct: allPct,
      weeklySonnetPct: sonnetPct,
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Bạn đã log cho tuần này rồi.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage-log/mine — get my usage logs
router.get('/mine', async (req, res) => {
  try {
    const logs = await UsageLog.find({ user_id: req.user.id })
      .sort({ week_start: -1 })
      .limit(20)
      .lean();
    const result = logs.map(l => ({ ...l, id: l._id }));
    res.json({ logs: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
