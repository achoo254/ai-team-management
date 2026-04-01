import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware.js'
import { Team } from '../models/team.js'
import { User } from '../models/user.js'
import { Seat } from '../models/seat.js'

const router = Router()

// GET /api/teams — list teams with user/seat counts (auth)
router.get('/', authenticate, async (_req, res) => {
  try {
    const teams = await Team.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'name',
          foreignField: 'team',
          as: 'users',
        },
      },
      {
        $lookup: {
          from: 'seats',
          localField: 'name',
          foreignField: 'team',
          as: 'seats',
        },
      },
      {
        $addFields: {
          user_count: { $size: '$users' },
          seat_count: { $size: '$seats' },
        },
      },
      { $project: { users: 0, seats: 0 } },
      { $sort: { name: 1 } },
    ])

    res.json({ teams })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/teams — create team (admin)
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, label, color } = req.body
    const team = await Team.create({ name: name?.toLowerCase(), label, color })
    res.status(201).json(team)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/teams/:id — update team (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { label, color } = req.body

    const update: Record<string, unknown> = {}
    if (label !== undefined) update.label = label
    if (color !== undefined) update.color = color

    const team = await Team.findByIdAndUpdate(id, update, { new: true }).lean()
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }

    res.json(team)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/teams/:id — delete team, reject if has users or seats (admin)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const team = await Team.findById(id).lean()
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }

    const [userCount, seatCount] = await Promise.all([
      User.countDocuments({ team: team.name }),
      Seat.countDocuments({ team: team.name }),
    ])

    if (userCount > 0 || seatCount > 0) {
      res.status(400).json({ error: 'Cannot delete team with existing users or seats' })
      return
    }

    await Team.findByIdAndDelete(id)
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
