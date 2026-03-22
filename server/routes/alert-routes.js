const router = require('express').Router();
const Alert = require('../models/alert-model');
const { authenticate, requireAdmin, validateObjectId } = require('../middleware/auth-middleware');

router.use(authenticate);

// GET /api/alerts?resolved=0|1
router.get('/', async (req, res) => {
  try {
    const { resolved } = req.query;
    let query = {};
    if (resolved !== undefined) {
      query.resolved = resolved === '1' || resolved === 'true';
    }
    const alerts = await Alert.find(query).sort({ created_at: -1 }).lean();
    const result = alerts.map(a => ({ ...a, id: a._id }));
    res.json({ alerts: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/alerts/:id/resolve
router.put('/:id/resolve', requireAdmin, validateObjectId, async (req, res) => {
  try {
    const resolvedBy = req.user.name || req.user.email;
    const alert = await Alert.findOneAndUpdate(
      { _id: req.params.id, resolved: false },
      { resolved: true, resolved_by: resolvedBy, resolved_at: new Date() },
      { new: true }
    ).lean();

    if (!alert) return res.status(404).json({ error: 'Alert not found or already resolved' });
    res.json({ alert: { ...alert, id: alert._id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
