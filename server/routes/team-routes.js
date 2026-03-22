const router = require('express').Router();
const { getDb } = require('../db/database');
const { authenticate, requireAdmin } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/teams — list all teams
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const teams = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM users u WHERE u.team = t.name) as user_count,
        (SELECT COUNT(*) FROM seats s WHERE s.team = t.name) as seat_count
      FROM teams t ORDER BY t.id
    `).all();
    res.json({ teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teams — create team (admin only)
router.post('/', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { name, label, color } = req.body;
    if (!name || !label) return res.status(400).json({ error: 'name, label required' });
    const result = db.prepare(
      'INSERT INTO teams (name, label, color) VALUES (?, ?, ?)'
    ).run(name.toLowerCase(), label, color || '#3b82f6');
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ team });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Tên team đã tồn tại' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/teams/:id — update team (admin only)
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const { label, color } = req.body;
    const old = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'Team not found' });

    db.prepare('UPDATE teams SET label = COALESCE(?, label), color = COALESCE(?, color) WHERE id = ?')
      .run(label, color, req.params.id);
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    res.json({ team });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/teams/:id — delete team (admin only, must have no users/seats)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const users = db.prepare('SELECT COUNT(*) as c FROM users WHERE team = ?').get(team.name).c;
    const seats = db.prepare('SELECT COUNT(*) as c FROM seats WHERE team = ?').get(team.name).c;
    if (users > 0 || seats > 0) {
      return res.status(400).json({ error: `Không thể xoá: còn ${users} user và ${seats} seat thuộc team này` });
    }

    db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
    res.json({ message: 'Team deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
