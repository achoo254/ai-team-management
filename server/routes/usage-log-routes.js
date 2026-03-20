const router = require('express').Router();
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth-middleware');
const { logUsage } = require('../services/usage-sync-service');

router.use(authenticate);

// POST /api/usage-log — user self-reports a usage session
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT u.*, s.email as seat_email FROM users u JOIN seats s ON s.id = u.seat_id WHERE u.id = ?').get(req.user.id);
    if (!user) return res.status(400).json({ error: 'User has no assigned seat' });

    const { date, sessions, tokensBefore, tokensAfter, purpose, project } = req.body;
    const logDate = date || new Date().toISOString().split('T')[0];

    const result = logUsage({
      seatEmail: user.seat_email,
      userId: user.id,
      userName: user.name,
      date: logDate,
      sessions: sessions || 1,
      tokensBefore,
      tokensAfter,
      purpose,
      project,
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Bạn đã log cho ngày này rồi. Sử dụng ngày khác hoặc liên hệ admin.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/usage-log/mine — get my usage logs
router.get('/mine', (req, res) => {
  try {
    const db = getDb();
    const logs = db.prepare(
      'SELECT * FROM usage_logs WHERE user_id = ? ORDER BY date DESC LIMIT 30'
    ).all(req.user.id);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
