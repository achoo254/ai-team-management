const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const config = require('./config');
const { initializeDb } = require('./db/migrations');
const { closeDb } = require('./db/database');

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize database
initializeDb();
console.log('[DB] Database initialized with seed data');

// Routes
app.use('/api/auth', require('./routes/auth-routes'));
app.use('/api/dashboard', require('./routes/dashboard-routes'));
app.use('/api/seats', require('./routes/seat-routes'));
app.use('/api/schedules', require('./routes/schedule-routes'));
app.use('/api/alerts', require('./routes/alert-routes'));
app.use('/api/admin', require('./routes/admin-routes'));
app.use('/api/usage-log', require('./routes/usage-log-routes'));

// SPA fallback — serve index.html for non-API routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') && req.method === 'GET') {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  }
  next();
});

// Start server
const server = app.listen(config.port, () => {
  console.log(`[Server] AI Manager running on http://localhost:${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

module.exports = app;
