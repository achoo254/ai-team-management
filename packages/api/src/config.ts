export const config = {
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/ai_team_management_db',
  jwtSecret: process.env.JWT_SECRET || '',
  firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  webUrl: process.env.WEB_URL || 'http://localhost:5173',
  apiPort: parseInt(process.env.API_PORT || '8386'),
  alerts: {
    defaultRateLimitPct: 80,
    defaultExtraCreditPct: 80,
  },
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  anthropic: {
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    adminKey: process.env.ANTHROPIC_ADMIN_KEY || '',
    version: process.env.ANTHROPIC_VERSION || '2023-06-01',
    oauthClientId: process.env.ANTHROPIC_OAUTH_CLIENT_ID || '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
  },
  // BLD digest config
  dataDir: process.env.DATA_DIR || './data',
  digestLinkSecret: process.env.DIGEST_LINK_SECRET || '',
  bldDigestTelegramTopicId: process.env.BLD_DIGEST_TELEGRAM_TOPIC_ID || null,
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
    topicId: process.env.TELEGRAM_TOPIC_ID || null,
  },
}
