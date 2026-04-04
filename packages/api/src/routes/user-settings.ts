import { Router } from 'express'
import { authenticate } from '../middleware.js'
import { User } from '../models/user.js'
import { encrypt, decrypt, isEncryptionConfigured } from '../lib/encryption.js'

const router = Router()

router.use(authenticate)

// GET /api/user/settings — current user's bot settings (masked)
router.get('/settings', async (req, res) => {
  try {
    const user = await User.findById(req.user!._id, 'telegram_chat_id telegram_bot_token')
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    res.json({
      telegram_chat_id: user.telegram_chat_id ?? null,
      has_telegram_bot: !!user.telegram_bot_token && !!user.telegram_chat_id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/user/settings — update bot config
router.put('/settings', async (req, res) => {
  try {
    if (!isEncryptionConfigured()) {
      res.status(503).json({ error: 'Encryption not configured. Set ENCRYPTION_KEY env var.' })
      return
    }

    const { telegram_bot_token, telegram_chat_id } = req.body
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

    await user.save()
    res.json({
      telegram_chat_id: user.telegram_chat_id,
      has_telegram_bot: !!user.telegram_bot_token && !!user.telegram_chat_id,
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
