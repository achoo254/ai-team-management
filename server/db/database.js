const mongoose = require('mongoose');
const config = require('../config');

async function connectDb() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('[DB] MongoDB connected');
  } catch (err) {
    console.error('[DB] MongoDB connection error:', err.message);
    process.exit(1);
  }
}

async function closeDb() {
  await mongoose.connection.close();
  console.log('[DB] MongoDB disconnected');
}

module.exports = { connectDb, closeDb };
