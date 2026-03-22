const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const config = require('../config');

/** Verify JWT token from cookie or Authorization header */
function authenticate(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Require admin role */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/** Validate :id param is a valid ObjectId */
function validateObjectId(req, res, next) {
  const id = req.params.id || req.params.seatId || req.params.userId;
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, validateObjectId };
