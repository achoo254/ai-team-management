const router = require('express').Router();
const Seat = require('../models/seat-model');
const UsageLog = require('../models/usage-log-model');
const { authenticate } = require('../middleware/auth-middleware');
const { getCurrentWeekStart } = require('../services/usage-sync-service');

router.use(authenticate);

// POST /api/usage-log/bulk — log usage for multiple seats at once
router.post('/bulk', async (req, res) => {
  try {
    const { weekStart, entries } = req.body;
    const week = weekStart || getCurrentWeekStart();

    // Validate weekStart is a Monday (ISO day 1)
    const weekDate = new Date(week + 'T00:00:00');
    if (isNaN(weekDate.getTime()) || weekDate.getDay() !== 1) {
      return res.status(400).json({ error: 'weekStart phải là ngày thứ Hai (YYYY-MM-DD)' });
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'entries is required' });
    }

    const results = [];
    const errors = [];

    for (const entry of entries) {
      const allPct = Math.max(0, Math.min(100, parseInt(entry.weeklyAllPct) || 0));
      const sonnetPct = Math.max(0, Math.min(100, parseInt(entry.weeklySonnetPct) || 0));
      try {
        await UsageLog.findOneAndUpdate(
          { seat_email: entry.seatEmail, week_start: week, user_id: req.user.id },
          { weekly_all_pct: allPct, weekly_sonnet_pct: sonnetPct, logged_at: new Date() },
          { upsert: true, new: true }
        );
        results.push({ seatEmail: entry.seatEmail, success: true });
      } catch (err) {
        errors.push({ seatEmail: entry.seatEmail, error: err.message });
      }
    }

    res.status(201).json({ weekStart: week, results, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage-log/week?weekStart=YYYY-MM-DD — get all seat logs for a week
router.get('/week', async (req, res) => {
  try {
    const week = req.query.weekStart || getCurrentWeekStart();
    const seats = await Seat.find().sort({ _id: 1 }).lean();
    const logs = await UsageLog.find({ week_start: week }).lean();

    // Group logs by seat_email (take latest entry per seat)
    const logBySeat = {};
    for (const l of logs) {
      if (!logBySeat[l.seat_email] || l.logged_at > logBySeat[l.seat_email].logged_at) {
        logBySeat[l.seat_email] = l;
      }
    }

    const result = seats.map(s => ({
      seatId: s._id,
      seatEmail: s.email,
      seatLabel: s.label,
      team: s.team,
      weeklyAllPct: logBySeat[s.email]?.weekly_all_pct ?? null,
      weeklySonnetPct: logBySeat[s.email]?.weekly_sonnet_pct ?? null,
      loggedAt: logBySeat[s.email]?.logged_at ?? null,
    }));

    res.json({ weekStart: week, seats: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
