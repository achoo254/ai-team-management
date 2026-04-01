import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware.js'
import { User } from '../models/user.js'
import { checkAlerts } from '../services/alert-service.js'
import { sendWeeklyReport } from '../services/telegram-service.js'

const router = Router()

// All admin routes require auth + admin role
router.use(authenticate, requireAdmin)

// Module-level cooldown state for send-report (60s)
let lastReportSent = 0
const COOLDOWN_MS = 60_000

// GET /api/admin/users — list all users with populated seat
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().populate('seat_ids', 'label email').lean()
    const mapped = users.map((u) => {
      const seats = (u.seat_ids ?? []) as { _id: unknown; label?: string; email?: string }[]
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        team: u.team,
        seat_ids: seats.map((s) => s._id),
        active: u.active,
        seat_labels: seats.map((s) => s.label).filter(Boolean),
      }
    })
    res.json({ users: mapped })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/admin/users — create user
router.post('/users', async (req, res) => {
  try {
    const { name, email, role = 'user', team, seatId } = req.body
    const user = await User.create({ name, email, role, team, seat_ids: seatId ? [seatId] : [] })
    res.status(201).json(user)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PATCH /api/admin/users/bulk-active — MUST be before /:id to avoid route conflict
router.patch('/users/bulk-active', async (req, res) => {
  try {
    const { active } = req.body
    // Exclude self from deactivation
    await User.updateMany({ _id: { $ne: req.user!._id } }, { active })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/admin/users/:id — update user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, role, team, seatId, active } = req.body

    // Can't deactivate self
    if (active === false && req.user!._id === id) {
      res.status(400).json({ error: 'Cannot deactivate your own account' })
      return
    }

    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = name
    if (email !== undefined) update.email = email
    if (role !== undefined) update.role = role
    if (team !== undefined) update.team = team
    if (seatId !== undefined) update.seat_ids = seatId ? [seatId] : []
    if (active !== undefined) update.active = active

    const updated = await User.findByIdAndUpdate(id, update, { new: true }).lean()
    if (!updated) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json(updated)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const deleted = await User.findByIdAndDelete(id).lean()
    if (!deleted) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/admin/check-alerts — run alert check
router.post('/check-alerts', async (_req, res) => {
  try {
    const result = await checkAlerts()
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/admin/send-report — send telegram weekly report with cooldown
router.post('/send-report', async (_req, res) => {
  try {
    const now = Date.now()
    const elapsed = now - lastReportSent
    if (lastReportSent > 0 && elapsed < COOLDOWN_MS) {
      const waitSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000)
      res.status(429).json({ error: 'Rate limited', waitSeconds: waitSec })
      return
    }
    lastReportSent = now
    await sendWeeklyReport()
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
