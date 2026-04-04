import { Router } from 'express'
import { authenticate } from '../middleware.js'
import { User } from '../models/user.js'
import { Seat } from '../models/seat.js'
import { encrypt, decrypt, isEncryptionConfigured } from '../lib/encryption.js'

const router = Router()

router.use(authenticate)

// GET /api/user/settings — current user's bot + alert settings
router.get('/settings', async (req, res) => {
  try {
    const user = await User.findById(
      req.user!._id,
      'telegram_chat_id telegram_bot_token notification_settings alert_settings seat_ids',
    )
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    // Available seats: admin → all, user → owned + assigned
    let availableSeats
    if (req.user!.role === 'admin') {
      availableSeats = await Seat.find({}, '_id label email team').lean()
    } else {
      const ownedSeats = await Seat.find({ owner_id: req.user!._id }, '_id label email team').lean()
      const assignedSeats = user.seat_ids?.length
        ? await Seat.find({ _id: { $in: user.seat_ids } }, '_id label email team').lean()
        : []
      const seatMap = new Map<string, any>()
      for (const s of [...ownedSeats, ...assignedSeats]) seatMap.set(String(s._id), s)
      availableSeats = Array.from(seatMap.values())
    }

    res.json({
      telegram_chat_id: user.telegram_chat_id ?? null,
      has_telegram_bot: !!user.telegram_bot_token && !!user.telegram_chat_id,
      notification_settings: user.notification_settings ?? null,
      alert_settings: user.alert_settings ?? null,
      available_seats: availableSeats,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/user/settings — update bot config
router.put('/settings', async (req, res) => {
  try {
    const { telegram_bot_token, telegram_chat_id, notification_settings, alert_settings } = req.body

    if (telegram_bot_token !== undefined && !isEncryptionConfigured()) {
      res.status(503).json({ error: 'Encryption not configured. Set ENCRYPTION_KEY env var.' })
      return
    }
    const user = await User.findById(req.user!._id)
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    // Clear config if token is empty
    if (telegram_bot_token === '' || telegram_bot_token === null) {
      user.telegram_bot_token = null
      user.telegram_chat_id = null
    } else {
      if (telegram_bot_token) {
        user.telegram_bot_token = encrypt(telegram_bot_token)
      }
      if (telegram_chat_id !== undefined) {
        user.telegram_chat_id = telegram_chat_id || null
      }
    }

    // Update notification settings
    if (notification_settings) {
      const ns = notification_settings
      const days = Array.isArray(ns.report_days)
        ? [...new Set(ns.report_days.filter((d: unknown) => Number.isInteger(d) && d >= 0 && d <= 6))]
        : []
      if (ns.report_enabled && days.length === 0) {
        res.status(400).json({ error: 'Cần chọn ít nhất 1 ngày gửi báo c��o' })
        return
      }
      user.notification_settings = {
        report_enabled: !!ns.report_enabled,
        report_days: days,
        report_hour: Math.max(0, Math.min(23, Math.floor(Number(ns.report_hour) || 0))),
        report_scope: req.user!.role === 'admin' && ns.report_scope === 'all' ? 'all' : 'own',
      }
    }

    // Update alert settings
    if (alert_settings) {
      const as = alert_settings
      const rlp = Math.max(1, Math.min(100, Math.floor(Number(as.rate_limit_pct) || 80)))
      const ecp = Math.max(1, Math.min(100, Math.floor(Number(as.extra_credit_pct) || 80)))

      // Validate seat IDs exist in DB (prevents garbage ObjectIds)
      let validSeatIds: string[] = as.subscribed_seat_ids ?? []
      const existingSeats = await Seat.find({ _id: { $in: validSeatIds } }, '_id').lean()
      const existingSet = new Set(existingSeats.map(s => String(s._id)))
      validSeatIds = validSeatIds.filter((id: string) => existingSet.has(id))

      // Non-admin: further restrict to owned/assigned seats
      if (req.user!.role !== 'admin') {
        const userSeatIds = new Set((user.seat_ids ?? []).map(String))
        const ownedSeats = await Seat.find({ owner_id: req.user!._id }, '_id').lean()
        for (const s of ownedSeats) userSeatIds.add(String(s._id))
        validSeatIds = validSeatIds.filter((id: string) => userSeatIds.has(id))
      }

      user.alert_settings = {
        enabled: !!as.enabled,
        rate_limit_pct: rlp,
        extra_credit_pct: ecp,
        subscribed_seat_ids: validSeatIds as any,
      }
    }

    await user.save()
    res.json({
      telegram_chat_id: user.telegram_chat_id,
      has_telegram_bot: !!user.telegram_bot_token && !!user.telegram_chat_id,
      notification_settings: user.notification_settings ?? null,
      alert_settings: user.alert_settings ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/user/settings/test-bot — send test message via user's personal bot
router.post('/settings/test-bot', async (req, res) => {
  try {
    if (!isEncryptionConfigured()) {
      res.status(503).json({ error: 'Encryption not configured' })
      return
    }

    const user = await User.findById(req.user!._id, 'telegram_bot_token telegram_chat_id')
    if (!user?.telegram_bot_token || !user?.telegram_chat_id) {
      res.status(400).json({ error: 'Bot not configured. Save token and chat ID first.' })
      return
    }

    const token = decrypt(user.telegram_bot_token)
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const tgRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegram_chat_id,
        text: '✅ Test message from Claude Teams Dashboard — bot hoạt động!',
        parse_mode: 'HTML',
      }),
    })

    if (!tgRes.ok) {
      const errText = await tgRes.text()
      res.status(400).json({ error: `Telegram API error: ${errText.slice(0, 200)}` })
      return
    }

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
