import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware.js'
import { Setting, getOrCreateSettings } from '../models/setting.js'

const router = Router()

// All settings routes require auth
router.use(authenticate)

/** Mask bot token for API response: show only last 4 chars */
function maskToken(token: string): string {
  if (!token || token.length <= 4) return token ? '••••' : ''
  return '••••' + token.slice(-4)
}

// GET /api/settings — return current settings (bot token masked)
router.get('/', async (_req, res) => {
  try {
    const settings = await getOrCreateSettings()
    const obj = settings.toJSON()
    // Mask bot token in response
    if (obj.telegram?.bot_token) {
      obj.telegram.bot_token = maskToken(obj.telegram.bot_token)
    }
    res.json(obj)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/settings — admin only, update settings
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { alerts, telegram } = req.body
    const update: Record<string, unknown> = {}

    // Alert thresholds
    if (alerts && typeof alerts === 'object') {
      if (alerts.rate_limit_pct != null) {
        const v = Number(alerts.rate_limit_pct)
        if (isNaN(v) || v <= 0 || v > 100) { res.status(400).json({ error: 'rate_limit_pct must be 1-100' }); return }
        update['alerts.rate_limit_pct'] = v
      }
      if (alerts.extra_credit_pct != null) {
        const v = Number(alerts.extra_credit_pct)
        if (isNaN(v) || v <= 0 || v > 100) { res.status(400).json({ error: 'extra_credit_pct must be 1-100' }); return }
        update['alerts.extra_credit_pct'] = v
      }
    }

    // Telegram config
    if (telegram && typeof telegram === 'object') {
      if (typeof telegram.bot_token === 'string') update['telegram.bot_token'] = telegram.bot_token.trim()
      if (typeof telegram.chat_id === 'string') update['telegram.chat_id'] = telegram.chat_id.trim()
      if (typeof telegram.topic_id === 'string') update['telegram.topic_id'] = telegram.topic_id.trim()
    }

    if (Object.keys(update).length === 0) {
      res.status(400).json({ error: 'No valid fields to update' })
      return
    }

    const doc = await Setting.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true })
    const obj = doc.toJSON()
    if (obj.telegram?.bot_token) obj.telegram.bot_token = maskToken(obj.telegram.bot_token)
    res.json(obj)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
