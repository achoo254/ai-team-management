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
      'telegram_chat_id telegram_topic_id telegram_bot_token watched_seat_ids notification_settings alert_settings seat_ids push_enabled',
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
      telegram_topic_id: user.telegram_topic_id ?? null,
      has_telegram_bot: !!user.telegram_bot_token && !!user.telegram_chat_id,
      watched_seat_ids: (user.watched_seat_ids ?? []).map(String),
      notification_settings: user.notification_settings ?? null,
      alert_settings: user.alert_settings ?? null,
      push_enabled: user.push_enabled ?? false,
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
    const { telegram_bot_token, telegram_chat_id, telegram_topic_id, watched_seat_ids, notification_settings, alert_settings, push_enabled } = req.body

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
      user.telegram_topic_id = null
    } else {
      if (telegram_bot_token) {
        user.telegram_bot_token = encrypt(telegram_bot_token)
      }
      if (telegram_chat_id !== undefined) {
        user.telegram_chat_id = telegram_chat_id || null
      }
      if (telegram_topic_id !== undefined) {
        user.telegram_topic_id = telegram_topic_id || null
      }
    }

    // Update watched seat IDs
    if (watched_seat_ids !== undefined) {
      let validIds: string[] = Array.isArray(watched_seat_ids) ? watched_seat_ids : []
      const existingSeats = await Seat.find({ _id: { $in: validIds } }, '_id').lean()
      const existingSet = new Set(existingSeats.map(s => String(s._id)))
      validIds = validIds.filter((id: string) => existingSet.has(id))

      // Non-admin: restrict to owned/assigned seats
      if (req.user!.role !== 'admin') {
        const userSeatIds = new Set((user.seat_ids ?? []).map(String))
        const ownedSeats = await Seat.find({ owner_id: req.user!._id }, '_id').lean()
        for (const s of ownedSeats) userSeatIds.add(String(s._id))
        validIds = validIds.filter((id: string) => userSeatIds.has(id))
      }
      user.watched_seat_ids = validIds as any
    }

    // Update notification settings
    if (notification_settings) {
      const ns = notification_settings
      const days = Array.isArray(ns.report_days)
        ? [...new Set((ns.report_days as unknown[]).filter((d): d is number => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))]
        : []
      if (ns.report_enabled && days.length === 0) {
        res.status(400).json({ error: 'Cần chọn ít nhất 1 ngày gửi báo c��o' })
        return
      }
      user.notification_settings = {
        report_enabled: !!ns.report_enabled,
        report_days: days,
        report_hour: Math.max(0, Math.min(23, Math.floor(Number(ns.report_hour) || 0))),
      }
    }

    // Update push notification setting
    if (push_enabled !== undefined) {
      user.push_enabled = !!push_enabled
    }

    // Update alert settings
    if (alert_settings) {
      const as = alert_settings
      const rlp = Math.max(1, Math.min(100, Math.floor(Number(as.rate_limit_pct) || 80)))
      const ecp = Math.max(1, Math.min(100, Math.floor(Number(as.extra_credit_pct) || 80)))

      user.alert_settings = {
        enabled: !!as.enabled,
        rate_limit_pct: rlp,
        extra_credit_pct: ecp,
      }
    }

    await user.save()
    res.json({
      telegram_chat_id: user.telegram_chat_id,
      telegram_topic_id: user.telegram_topic_id ?? null,
      has_telegram_bot: !!user.telegram_bot_token && !!user.telegram_chat_id,
      watched_seat_ids: (user.watched_seat_ids ?? []).map(String),
      notification_settings: user.notification_settings ?? null,
      alert_settings: user.alert_settings ?? null,
      push_enabled: user.push_enabled ?? false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/user/settings/fcm-token — register FCM token
router.post('/settings/fcm-token', async (req, res) => {
  try {
    const { token } = req.body
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Token required' })
      return
    }

    const user = await User.findById(req.user!._id, 'fcm_tokens')
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    // Remove oldest token if at 10-device cap
    if ((user.fcm_tokens?.length ?? 0) >= 10) {
      await User.updateOne({ _id: req.user!._id }, { $pop: { fcm_tokens: -1 } })
    }
    await User.updateOne({ _id: req.user!._id }, { $addToSet: { fcm_tokens: token } })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/user/settings/fcm-token — unregister FCM token
router.delete('/settings/fcm-token', async (req, res) => {
  try {
    const { token } = req.body
    if (!token) { res.status(400).json({ error: 'Token required' }); return }

    await User.updateOne({ _id: req.user!._id }, { $pull: { fcm_tokens: token } })
    res.json({ success: true })
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

    const user = await User.findById(req.user!._id, 'telegram_bot_token telegram_chat_id telegram_topic_id')
    if (!user?.telegram_bot_token || !user?.telegram_chat_id) {
      res.status(400).json({ error: 'Bot not configured. Save token and chat ID first.' })
      return
    }

    const token = decrypt(user.telegram_bot_token)
    const url = `https://api.telegram.org/bot${token}/sendMessage`
    const body: Record<string, unknown> = {
      chat_id: user.telegram_chat_id,
      text: '✅ Test message from Claude Teams Dashboard — bot hoạt động!',
      parse_mode: 'HTML',
    }
    if (user.telegram_topic_id) body.message_thread_id = parseInt(user.telegram_topic_id)
    const tgRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
