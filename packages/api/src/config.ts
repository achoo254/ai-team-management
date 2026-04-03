export const config = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ai_team_management_db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  webUrl: process.env.WEB_URL || 'http://localhost:5173',
  apiPort: parseInt(process.env.API_PORT || '8386'),
  alerts: {
    highUsagePct: 80,
    inactivityWeeks: 1,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    topicId: process.env.TELEGRAM_TOPIC_ID || '',
  },
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  anthropic: {
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    adminKey: process.env.ANTHROPIC_ADMIN_KEY || '',
    version: process.env.ANTHROPIC_VERSION || '2023-06-01',
  },
}
