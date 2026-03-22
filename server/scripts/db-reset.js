const mongoose = require('mongoose');
const config = require('../config');

(async () => {
  await mongoose.connect(config.mongoUri);
  await mongoose.connection.dropDatabase();
  console.log('[DB] Database dropped');
  const { initializeDb } = require('../db/migrations');
  await initializeDb();
  console.log('[DB] Seed data inserted');
  await mongoose.connection.close();
  process.exit(0);
})();
