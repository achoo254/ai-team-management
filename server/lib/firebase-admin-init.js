const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const serviceAccountPath = path.resolve(config.firebaseServiceAccountPath);
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
