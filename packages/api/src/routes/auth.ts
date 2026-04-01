import { Router } from 'express'
import { getAdminAuth } from '../firebase-admin.js'
import { signToken, authenticate } from '../middleware.js'
import { User } from '../models/user.js'

const router = Router()

// POST /api/auth/google — verify Firebase token, find user, issue JWT cookie
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required' })
      return
    }

    // Verify Firebase token
    let decoded
    try {
      decoded = await getAdminAuth().verifyIdToken(idToken)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === 'auth/id-token-expired') {
        res.status(401).json({ error: 'Token expired' })
        return
      }
      res.status(401).json({ error: 'Invalid token' })
      return
    }

    const email = decoded.email
    if (!email) {
      res.status(401).json({ error: 'No email in token' })
      return
    }

    const user = await User.findOne({ email }).lean()
    if (!user) {
      res.status(401).json({ error: 'User not found' })
      return
    }

    const payload = {
      _id: String(user._id),
      name: user.name,
      email: user.email ?? email,
      role: user.role,
      team: user.team,
    }

    const token = signToken(payload)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400000, // 24h
      path: '/',
    })

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        team: user.team,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/auth/logout — clear token cookie
router.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ message: 'Logged out' })
})

// GET /api/auth/me — return current authenticated user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user!._id)
      .select('name email role team seat_id')
      .lean()
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({ user: { id: user._id, ...user } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
