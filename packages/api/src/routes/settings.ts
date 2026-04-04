import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware.js'
import { Setting, getOrCreateSettings } from '../models/setting.js'

const router = Router()

// All settings routes require auth
router.use(authenticate)

// GET /api/settings — return current settings
router.get('/', async (_req, res) => {
  try {
    const settings = await getOrCreateSettings()
    res.json(settings)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/settings — admin only, update alert thresholds
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { alerts } = req.body
    if (!alerts || typeof alerts !== 'object') {
      res.status(400).json({ error: 'Missing alerts object' })
      return
    }

    const update: Record<string, number> = {}
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

    const doc = await Setting.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true })
    res.json(doc)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
