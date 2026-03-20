const router = require('express').Router();
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/seats
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const seats = db.prepare(`
      SELECT s.*, GROUP_CONCAT(u.id || ':' || u.name || ':' || u.email, '|') as users_raw
      FROM seats s
      LEFT JOIN users u ON u.seat_id = s.id
      GROUP BY s.id
      ORDER BY s.id
    `).all();

    const result = seats.map((s) => ({
      ...s,
      users: s.users_raw
        ? s.users_raw.split('|').map((u) => {
            const [id, name, email] = u.split(':');
            return { id: Number(id), name, email };
          })
        : [],
      users_raw: undefined,
    }));

    res.json({ seats: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/seats/:id
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { label, team, max_users } = req.body;
    db.prepare(
      'UPDATE seats SET label = COALESCE(?, label), team = COALESCE(?, team), max_users = COALESCE(?, max_users) WHERE id = ?'
    ).run(label, team, max_users, req.params.id);
    const seat = db.prepare('SELECT * FROM seats WHERE id = ?').get(req.params.id);
    if (!seat) return res.status(404).json({ error: 'Seat not found' });
    res.json({ seat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/seats/:id/assign
router.post('/:id/assign', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    db.prepare('UPDATE users SET seat_id = ? WHERE id = ?').run(req.params.id, userId);
    res.json({ message: 'User assigned to seat' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/seats/:id/unassign/:userId
router.delete('/:id/unassign/:userId', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE users SET seat_id = NULL WHERE id = ? AND seat_id = ?').run(
      req.params.userId,
      req.params.id
    );
    res.json({ message: 'User removed from seat' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
