require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  anthropicAdminKey: process.env.ANTHROPIC_ADMIN_KEY || '',
  anthropicVersion: '2023-06-01',
  anthropicBaseUrl: 'https://api.anthropic.com',
  // Cron: daily sync at 6:00 AM
  syncCron: '0 6 * * *',
  // Alert thresholds
  alerts: {
    highDailyCostCents: 200,       // $2/day
    weeklyPaceCostCents: 1500,     // $15/seat/week
    sessionSpikeCount: 10,         // sessions/day
    inactivityDays: 3,             // days without activity
  },
};
