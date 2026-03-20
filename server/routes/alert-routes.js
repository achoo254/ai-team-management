const router = require('express').Router();
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/alerts?resolved=0|1
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { resolved } = req.query;

    let alerts;
    if (resolved !== undefined) {
      alerts = db.prepare(
        'SELECT * FROM alerts WHERE resolved = ? ORDER BY created_at DESC'
      ).all(Number(resolved));
    } else {
      alerts = db.prepare(
        'SELECT * FROM alerts ORDER BY created_at DESC'
      ).all();
    }

    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const resolvedBy = req.user.name || req.user.email;

    const result = db.prepare(`
      UPDATE alerts
      SET resolved = 1, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE id = ? AND resolved = 0
    `).run(resolvedBy, req.params.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Alert not found or already resolved' });

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
    res.json({ alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
