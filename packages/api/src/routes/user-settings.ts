import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate } from '../middleware.js'
import { User } from '../models/user.js'
import { Seat } from '../models/seat.js'
import { encrypt, decrypt, isEncryptionConfigured } from '../lib/encryption.js'
import { sendUserReport } from '../services/telegram-service.js'
import { getMessaging } from '../firebase-admin.js'

const router = Router()

router.use(authenticate)

// GET /api/user/settings — current user's bot + alert settings
router.get('/settings', async (req, res) => {
  try {
    const user = await User.findById(
      req.user!._id,
      'telegram_chat_id telegram_topic_id telegram_bot_token watched_seats notification_settings alert_settings seat_ids push_enabled dashboard_filter_seat_ids dashboard_default_range',
    )
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    // Resolve accessible seats (admin → all, user → owned + assigned)
    let allAccessibleSeats: Array<{ _id: any; label: string; email: string }>
    if (req.user!.role === 'admin') {
      allAccessibleSeats = await Seat.find({}, '_id label email').lean() as any
    } else {
      const ownedSeats = await Seat.find({ owner_id: req.user!._id }, '_id label email').lean()
      const assignedSeats = user.seat_ids?.length
        ? await Seat.find({ _id: { $in: user.seat_ids } }, '_id label email').lean()
        : []
      const seatMap = new Map<string, any>()
      for (const s of [...ownedSeats, ...assignedSeats]) seatMap.set(String(s._id), s)
      allAccessibleSeats = Array.from(seatMap.values())
    }

    // Populate watched_seats with labels — skip soft-deleted seats
    const seatLookup = new Map(allAccessibleSeats.map((s) => [String(s._id), s]))
    const rawWatched = user.watched_seats ?? []
    const staleIds = rawWatched
      .map((ws) => String(ws.seat_id))
      .filter((id) => !seatLookup.has(id))
    // Auto-cleanup: remove watched entries for deleted/inaccessible seats
    if (staleIds.length > 0) {
      const staleSet = new Set(staleIds)
      user.watched_seats = rawWatched.filter((ws) => !staleSet.has(String(ws.seat_id)))
      await user.save()
    }
    const watchedSeats = (user.watched_seats ?? []).map((ws) => {
      const s = seatLookup.get(String(ws.seat_id))
      return {
        seat_id: String(ws.seat_id),
        threshold_5h_pct: ws.threshold_5h_pct,
        threshold_7d_pct: ws.threshold_7d_pct,
        burn_rate_threshold: ws.burn_rate_threshold ?? 15,
        eta_warning_hours: ws.eta_warning_hours ?? 1.5,
        forecast_warning_hours: ws.forecast_warning_hours ?? 48,
        seat_label: s?.label ?? null,
        seat_email: s?.email ?? null,
      }
    })

    // Available seats = accessible seats not yet watched
    const watchedIdSet = new Set(watchedSeats.map((w) => w.seat_id))
    const availableSeats = allAccessibleSeats.filter((s) => !watchedIdSet.has(String(s._id)))

    res.json({
      telegram_chat_id: user.telegram_chat_id ?? null,
      telegram_topic_id: user.telegram_topic_id ?? null,
      has_telegram_bot: !!user.telegram_bot_token && !!user.telegram_chat_id,
      watched_seats: watchedSeats,
      notification_settings: user.notification_settings ?? null,
      alert_settings: user.alert_settings ?? null,
      push_enabled: user.push_enabled ?? false,
      dashboard_filter_seat_ids: (user.dashboard_filter_seat_ids ?? []).map(String),
      dashboard_default_range: user.dashboard_default_range ?? 'day',
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
    const { telegram_bot_token, telegram_chat_id, telegram_topic_id, notification_settings, alert_settings, push_enabled, dashboard_filter_seat_ids, dashboard_default_range } = req.body

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

    // Update notification settings (cycle-based: chỉ còn toggle report_enabled)
    if (notification_settings) {
      const ns = notification_settings
      // Preserve existing cycle_reported map khi update toggle
      const existingCycle = user.notification_settings?.cycle_reported ?? new Map<string, Date>()
      user.notification_settings = {
        report_enabled: !!ns.report_enabled,
        cycle_reported: existingCycle,
      }
    }

    // Update push notification setting
    if (push_enabled !== undefined) {
      user.push_enabled = !!push_enabled
    }

    // Update alert settings (channels + type toggles)
    if (alert_settings) {
      const as = alert_settings
      user.alert_settings = {
        enabled: !!as.enabled,
        telegram_enabled: as.telegram_enabled !== false,
        token_failure_enabled: as.token_failure_enabled !== false,
        fleet_util_threshold_pct:
          as.fleet_util_threshold_pct == null || as.fleet_util_threshold_pct === ''
            ? null
            : Number(as.fleet_util_threshold_pct),
        fleet_util_threshold_days:
          as.fleet_util_threshold_days == null || as.fleet_util_threshold_days === ''
            ? null
            : Number(as.fleet_util_threshold_days),
      }
    }

    // Update dashboard default range
    const VALID_RANGES = ['day', 'week', 'month', '3month', '6month']
    if (dashboard_default_range && VALID_RANGES.includes(dashboard_default_range)) {
      user.dashboard_default_range = dashboard_default_range
    }

    // Update dashboard seat filter (per-user persistent filter)
    if (Array.isArray(dashboard_filter_seat_ids)) {
      user.dashboard_filter_seat_ids = dashboard_filter_seat_ids
        .filter((id: unknown) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id as string))
        .map((id: string) => new mongoose.Types.ObjectId(id))
    }

    await user.save()
    res.json({
      telegram_chat_id: user.telegram_chat_id,
      telegram_topic_id: user.telegram_topic_id ?? null,
      has_telegram_bot: !!user.telegram_bot_token && !!user.telegram_chat_id,
      notification_settings: user.notification_settings ?? null,
      alert_settings: user.alert_settings ?? null,
      push_enabled: user.push_enabled ?? false,
      dashboard_filter_seat_ids: (user.dashboard_filter_seat_ids ?? []).map(String),
      dashboard_default_range: user.dashboard_default_range ?? 'day',
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

// POST /api/user/settings/test-push — send test push notification to user's registered devices
router.post('/settings/test-push', async (req, res) => {
  try {
    const user = await User.findById(req.user!._id, 'fcm_tokens push_enabled')
    if (!user?.push_enabled) {
      res.status(400).json({ error: 'Desktop Push chưa được bật' })
      return
    }
    if (!user.fcm_tokens?.length) {
      res.status(400).json({ error: 'Chưa có thiết bị nào đăng ký push' })
      return
    }

    const messaging = getMessaging()
    const staleTokens: string[] = []
    const failures: Array<{ code?: string; message?: string }> = []
    let sent = 0

    await Promise.allSettled(
      user.fcm_tokens.map(async (token) => {
        try {
          await messaging.send({
            token,
            notification: {
              title: 'Test Desktop Push',
              body: 'Desktop push notification hoạt động bình thường!',
            },
            data: { type: 'test', url: '/settings' },
            webpush: { fcmOptions: { link: '/settings' } },
          })
          sent++
        } catch (err: any) {
          const code = err?.code
          const msg = err?.message
          console.error('[test-push] FCM send failed:', code, msg)
          if (code === 'messaging/registration-token-not-registered'
            || code === 'messaging/invalid-registration-token'
            || code === 'messaging/invalid-argument') {
            staleTokens.push(token)
          }
          failures.push({ code, message: msg?.slice(0, 200) })
        }
      }),
    )

    if (staleTokens.length > 0) {
      await User.updateOne({ _id: req.user!._id }, { $pull: { fcm_tokens: { $in: staleTokens } } })
    }

    if (sent === 0) {
      const first = failures[0]
      const detail = first ? ` (${first.code ?? 'unknown'}: ${first.message ?? ''})` : ''
      res.status(400).json({
        error: `Không gửi được push. Hãy tắt/bật lại Desktop Push.${detail}`,
        failures,
        stale_tokens_removed: staleTokens.length,
      })
      return
    }

    res.json({ success: true, sent, stale_tokens_removed: staleTokens.length })
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

// POST /api/user/settings/test-report — send test usage report via user's personal bot
router.post('/settings/test-report', async (req, res) => {
  try {
    await sendUserReport(String(req.user!._id))
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
