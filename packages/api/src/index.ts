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
import teamRoutes from './routes/teams.js'
import usageLogRoutes from './routes/usage-log.js'
import { sendLogReminder, sendWeeklyReport } from './services/telegram-service.js'

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
app.use('/api/teams', teamRoutes)
app.use('/api/usage-log', usageLogRoutes)

// Global error handler — must be last
app.use(errorHandler)

async function start() {
  await connectDb()

  // Seed data on first run
  const { initializeDb } = await import('./seed-data.js')
  await initializeDb()

  // Cron: Friday 15:00 Asia/Ho_Chi_Minh — log reminder
  cron.schedule('0 15 * * 5', () => {
    console.log('[Cron] Triggering log reminder...')
    sendLogReminder().catch(console.error)
  }, { timezone: 'Asia/Ho_Chi_Minh' })

  // Cron: Friday 17:00 Asia/Ho_Chi_Minh — weekly report
  cron.schedule('0 17 * * 5', () => {
    console.log('[Cron] Triggering weekly report...')
    sendWeeklyReport().catch(console.error)
  }, { timezone: 'Asia/Ho_Chi_Minh' })

  app.listen(config.apiPort, () => {
    console.log(`[API] Server running on port ${config.apiPort}`)
  })
}

start().catch(console.error)
