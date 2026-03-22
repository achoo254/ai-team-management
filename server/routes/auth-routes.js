const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user-model');
const config = require('../config');
const admin = require('../lib/firebase-admin-init');
const { authenticate } = require('../middleware/auth-middleware');

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email;
    if (!email) return res.status(401).json({ error: 'Google account has no email' });

    const user = await User.findOne({ email }).lean();
    if (!user) return res.status(401).json({ error: 'User not registered in system' });

    const token = jwt.sign(
      { id: user._id, email: user.email, name: user.name, role: user.role, team: user.team },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    });

    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, team: user.team } });
  } catch (err) {
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired, please sign in again' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email role team seat_id').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user._id, ...user } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
