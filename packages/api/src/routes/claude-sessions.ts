// GET /api/claude-sessions — list desktop telemetry sessions with permission scoping.
import { Router, type Request, type Response } from 'express'
import { authenticate } from '../middleware.js'
import { listClaudeSessions } from '../services/claude-sessions-query-service.js'

const router = Router()
router.use(authenticate)

router.get('/', async (req: Request, res: Response) => {
  const { seat_id, profile_email, since, until, limit } = req.query

  const parsedSince = typeof since === 'string' ? new Date(since) : undefined
  const parsedUntil = typeof until === 'string' ? new Date(until) : undefined
  if (parsedSince && Number.isNaN(parsedSince.getTime())) {
    res.status(400).json({ error: 'Invalid since date' })
    return
  }
  if (parsedUntil && Number.isNaN(parsedUntil.getTime())) {
    res.status(400).json({ error: 'Invalid until date' })
    return
  }

  const parsedLimit = typeof limit === 'string' ? Number.parseInt(limit, 10) : undefined
  if (parsedLimit !== undefined && (Number.isNaN(parsedLimit) || parsedLimit < 1)) {
    res.status(400).json({ error: 'Invalid limit' })
    return
  }

  const result = await listClaudeSessions(req.user!, {
    seat_id: typeof seat_id === 'string' ? seat_id : undefined,
    profile_email: typeof profile_email === 'string' ? profile_email : undefined,
    since: parsedSince,
    until: parsedUntil,
    limit: parsedLimit,
  })

  res.json(result)
})

export default router
