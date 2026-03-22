require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ai_team_management_db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  // Alert thresholds (percentage-based)
  alerts: {
    highUsagePct: 80,
    inactivityWeeks: 1,
  },
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    topicId: process.env.TELEGRAM_TOPIC_ID || '',
  },
};
