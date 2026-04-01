import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware.js'
import { Alert } from '../models/alert.js'

const router = Router()

// GET /api/alerts — list alerts, optional ?resolved=0|1
router.get('/', authenticate, async (req, res) => {
  try {
    const resolvedParam = req.query.resolved as string | undefined

    const filter: Record<string, unknown> = {}
    if (resolvedParam === '0') filter.resolved = false
    else if (resolvedParam === '1') filter.resolved = true

    const alerts = await Alert.find(filter).sort({ created_at: -1 }).lean()
    res.json({ alerts })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/alerts/:id/resolve — resolve an alert (admin only)
router.put('/:id/resolve', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const alert = await Alert.findOneAndUpdate(
      { _id: id, resolved: false },
      { resolved: true, resolved_by: req.user!.name, resolved_at: new Date() },
      { new: true },
    ).lean()

    if (!alert) {
      res.status(404).json({ error: 'Alert not found or already resolved' })
      return
    }

    res.json(alert)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
