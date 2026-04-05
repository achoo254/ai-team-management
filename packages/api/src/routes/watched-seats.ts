import { Router } from 'express'
import { Types } from 'mongoose'
import { authenticate, validateObjectId } from '../middleware.js'
import { User } from '../models/user.js'
import { Seat } from '../models/seat.js'

const router = Router()
router.use(authenticate)

/** Verify user has access to seat (owner/assigned/admin). Returns the seat doc or null. */
async function resolveAccessibleSeat(userId: string, role: string, seatId: string) {
  if (!Types.ObjectId.isValid(seatId)) return null
  const seat = await Seat.findById(seatId, '_id label email owner_id').lean()
  if (!seat) return null
  if (role === 'admin') return seat
  if (String(seat.owner_id) === userId) return seat
  const user = await User.findById(userId, 'seat_ids').lean()
  if ((user?.seat_ids ?? []).some((id) => String(id) === seatId)) return seat
  return null
}

function clampPct(val: unknown, fallback: number): number {
  const n = Math.floor(Number(val))
  if (!Number.isFinite(n)) return fallback
  return Math.max(1, Math.min(100, n))
}

// POST /api/user/watched-seats — start watching a seat with thresholds
router.post('/', async (req, res) => {
  try {
    const { seat_id, threshold_5h_pct, threshold_7d_pct } = req.body as {
      seat_id?: string
      threshold_5h_pct?: unknown
      threshold_7d_pct?: unknown
    }
    if (!seat_id) { res.status(400).json({ error: 'seat_id required' }); return }

    const seat = await resolveAccessibleSeat(String(req.user!._id), req.user!.role, seat_id)
    if (!seat) { res.status(403).json({ error: 'Seat not accessible' }); return }

    const user = await User.findById(req.user!._id)
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const already = (user.watched_seats ?? []).some((w) => String(w.seat_id) === String(seat._id))
    if (already) { res.status(409).json({ error: 'Already watching this seat' }); return }

    const entry = {
      seat_id: seat._id as any,
      threshold_5h_pct: clampPct(threshold_5h_pct, 90),
      threshold_7d_pct: clampPct(threshold_7d_pct, 85),
    }
    user.watched_seats = [...(user.watched_seats ?? []), entry]
    await user.save()

    res.json({
      seat_id: String(seat._id),
      threshold_5h_pct: entry.threshold_5h_pct,
      threshold_7d_pct: entry.threshold_7d_pct,
      seat_label: (seat as any).label,
      seat_email: (seat as any).email,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/user/watched-seats/:seatId — update thresholds
router.put('/:seatId', validateObjectId('seatId'), async (req, res) => {
  try {
    const { seatId } = req.params
    const { threshold_5h_pct, threshold_7d_pct } = req.body as {
      threshold_5h_pct?: unknown
      threshold_7d_pct?: unknown
    }

    const user = await User.findById(req.user!._id)
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const entry = (user.watched_seats ?? []).find((w) => String(w.seat_id) === seatId)
    if (!entry) { res.status(404).json({ error: 'Not watching this seat' }); return }

    if (threshold_5h_pct !== undefined) entry.threshold_5h_pct = clampPct(threshold_5h_pct, entry.threshold_5h_pct)
    if (threshold_7d_pct !== undefined) entry.threshold_7d_pct = clampPct(threshold_7d_pct, entry.threshold_7d_pct)

    user.markModified('watched_seats')
    await user.save()

    res.json({
      seat_id: seatId,
      threshold_5h_pct: entry.threshold_5h_pct,
      threshold_7d_pct: entry.threshold_7d_pct,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/user/watched-seats/:seatId — stop watching (idempotent)
router.delete('/:seatId', validateObjectId('seatId'), async (req, res) => {
  try {
    const { seatId } = req.params
    await User.updateOne(
      { _id: req.user!._id },
      { $pull: { watched_seats: { seat_id: seatId } } },
    )
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
