const router = require('express').Router();
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth-middleware');
const { logUsage, getCurrentWeekStart } = require('../services/usage-sync-service');

router.use(authenticate);

// POST /api/usage-log — log weekly usage percentages
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT u.*, s.email as seat_email FROM users u JOIN seats s ON s.id = u.seat_id WHERE u.id = ?').get(req.user.id);
    if (!user) return res.status(400).json({ error: 'User has no assigned seat' });

    const { weekStart, weeklyAllPct, weeklySonnetPct } = req.body;
    const week = weekStart || getCurrentWeekStart();
    const allPct = Math.max(0, Math.min(100, parseInt(weeklyAllPct) || 0));
    const sonnetPct = Math.max(0, Math.min(100, parseInt(weeklySonnetPct) || 0));

    // Validate weekStart is a Monday (ISO day 1)
    const weekDate = new Date(week + 'T00:00:00');
    if (isNaN(weekDate.getTime()) || weekDate.getDay() !== 1) {
      return res.status(400).json({ error: 'weekStart phải là ngày thứ Hai (YYYY-MM-DD)' });
    }

    const result = logUsage({
      seatEmail: user.seat_email,
      userId: user.id,
      weekStart: week,
      weeklyAllPct: allPct,
      weeklySonnetPct: sonnetPct,
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Bạn đã log cho tuần này rồi.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage-log/mine — get my usage logs
router.get('/mine', (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare(
      'SELECT * FROM usage_logs WHERE user_id = ? ORDER BY week_start DESC LIMIT 20'
    ).all(req.user.id);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
