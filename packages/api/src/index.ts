import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import cron from 'node-cron'
import { config } from './config.js'
import { connectDb } from './db.js'
import { errorHandler } from './middleware.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import alertRoutes from './routes/alerts.js'
import dashboardRoutes from './routes/dashboard.js'
import scheduleRoutes from './routes/schedules.js'
import seatRoutes from './routes/seats.js'
import usageSnapshotRoutes from './routes/usage-snapshots.js'
import userSettingsRoutes from './routes/user-settings.js'
import watchedSeatsRoutes from './routes/watched-seats.js'
import bldMetricsRoutes from './routes/bld-metrics.js'
import {
  checkAndSendScheduledReports,
} from './services/telegram-service.js'
import { collectAllUsage } from './services/usage-collector-service.js'
import { checkSnapshotAlerts } from './services/alert-service.js'
import { checkAndRefreshExpiring } from './services/token-refresh-service.js'
import { closeStaleUsageWindows } from './services/usage-window-applier.js'
import { cleanupExpiredDeletedSeats } from './services/seat-cleanup-service.js'
import { generateAllPatterns } from './services/activity-pattern-service.js'
const app = express()

// Middleware
app.use(cors({ origin: config.webUrl, credentials: true }))
app.use(express.json())
app.use(cookieParser())

// Routes — all mounted under /api
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/seats', seatRoutes)
app.use('/api/usage-snapshots', usageSnapshotRoutes)
app.use('/api/user', userSettingsRoutes)
app.use('/api/user/watched-seats', watchedSeatsRoutes)
app.use('/api/bld', bldMetricsRoutes)


// Global error handler — must be last
app.use(errorHandler)

async function start() {
  // Validate JWT secret — fail fast to prevent forged tokens with a known default
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set (min 32 chars) — refusing to start with weak/missing secret')
  }

  // Validate encryption key before accepting requests
  if (config.encryptionKey && config.encryptionKey.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string (32 bytes) or empty to disable')
  }

  await connectDb()

  // Cron: every hour — per-user notification schedules
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Checking scheduled reports...')
    checkAndSendScheduledReports().catch(console.error)
  }, { timezone: 'Asia/Ho_Chi_Minh' })

  // Cron: Every 5 min — check and refresh expiring OAuth tokens
  cron.schedule('*/5 * * * *', () => {
    console.log('[Cron] Checking token expiry...')
    checkAndRefreshExpiring().catch(console.error)
  }, { timezone: 'Asia/Ho_Chi_Minh' })

  // Cron: Every 5 min — collect usage snapshots, then check alerts
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Triggering usage collection...')
    await collectAllUsage().catch(console.error)
    console.log('[Cron] Checking snapshot alerts...')
    await checkSnapshotAlerts().catch(console.error)
  }, { timezone: 'Asia/Ho_Chi_Minh' })

  // Cron: Every 30 min — close stale UsageWindows
  cron.schedule('*/30 * * * *', () => {
    closeStaleUsageWindows().catch(console.error)
  }, { timezone: 'Asia/Ho_Chi_Minh' })

  // Cron: Daily 04:00 — generate activity patterns from seat_activity_log
  cron.schedule('0 4 * * *', () => {
    console.log('[Cron] Generating activity patterns...')
    generateAllPatterns().catch(console.error)
  }, { timezone: 'Asia/Ho_Chi_Minh' })

  // Cron: Daily 03:00 — hard-delete seats soft-deleted > 30 days ago (+ cascade usage/alerts)
  cron.schedule('0 3 * * *', () => {
    console.log('[Cron] Running seat cleanup...')
    cleanupExpiredDeletedSeats().catch(console.error)
  }, { timezone: 'Asia/Ho_Chi_Minh' })

  app.listen(config.apiPort, () => {
    console.log(`[API] Server running on port ${config.apiPort}`)
  })
}

start().catch(console.error)
