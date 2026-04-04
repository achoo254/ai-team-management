import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin, requireTeamOwnerOrAdmin, validateObjectId } from '../middleware.js'
import { Team } from '../models/team.js'
import { User } from '../models/user.js'
import { Seat } from '../models/seat.js'
import { emitTeamEvent } from '../services/alert-service.js'

const router = Router()

// GET /api/teams — list teams with user/seat counts (auth)
// ?owner=<userId> (admin only) | ?mine=true (created_by=self)
router.get('/', authenticate, async (req, res) => {
  try {
    const filter: Record<string, unknown> = {}
    const userId = new mongoose.Types.ObjectId(req.user!._id)

    if (req.query.owner) {
      if (req.user!.role !== 'admin') {
        res.status(403).json({ error: 'Admin-only filter' })
        return
      }
      filter.created_by = new mongoose.Types.ObjectId(req.query.owner as string)
    } else if (req.query.mine === 'true') {
      filter.created_by = userId
    } else if (req.user!.role !== 'admin') {
      // Non-admin: only see teams they created or are a member of
      const dbUser = await User.findById(req.user!._id, 'team_ids').lean()
      const memberTeamIds = (dbUser?.team_ids ?? []).map((id) => new mongoose.Types.ObjectId(String(id)))
      filter.$or = [
        { created_by: userId },
        { _id: { $in: memberTeamIds } },
      ]
    }

    const teams = await Team.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'team_ids',
          as: 'users',
        },
      },
      {
        $lookup: {
          from: 'seats',
          localField: '_id',
          foreignField: 'team_id',
          as: 'seats',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'created_by',
          foreignField: '_id',
          as: '_creator',
        },
      },
      {
        $addFields: {
          user_count: { $size: '$users' },
          seat_count: { $size: '$seats' },
          creator: { $arrayElemAt: ['$_creator', 0] },
        },
      },
      {
        $project: {
          users: 0, seats: 0, _creator: 0,
          'creator.telegram_bot_token': 0, 'creator.fcm_tokens': 0,
          'creator.alert_settings': 0, 'creator.notification_settings': 0,
        },
      },
      { $sort: { name: 1 } },
    ])

    // Slim down creator to { _id, name, email }
    const result = teams.map((t) => ({
      ...t,
      creator: t.creator ? { _id: t.creator._id, name: t.creator.name, email: t.creator.email } : null,
    }))

    res.json({ teams: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/teams — create team (any authenticated user)
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, color } = req.body
    if (!name?.trim()) {
      res.status(400).json({ error: 'name is required' })
      return
    }
    const trimmed = String(name).trim()
    if (trimmed.length > 50) {
      res.status(400).json({ error: 'name must be under 50 chars' })
      return
    }
    const team = await Team.create({
      name: trimmed,
      color,
      created_by: req.user!._id,
    })
    res.status(201).json(team)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// PUT /api/teams/:id — update team (owner or admin)
router.put('/:id', authenticate, validateObjectId('id'), requireTeamOwnerOrAdmin, async (req, res) => {
  try {
    const { name, color } = req.body
    const update: Record<string, unknown> = {}
    if (name !== undefined) update.name = String(name).trim().slice(0, 50)
    if (color !== undefined) update.color = color

    const team = await Team.findByIdAndUpdate(req.params.id as string, update, { new: true })
      .populate('created_by', 'name email')
      .lean()
    if (!team) {
      res.status(404).json({ error: 'Team not found' })
      return
    }

    // Notify team creator only if admin edited someone else's team
    const creatorId = String((team.created_by as any)._id ?? team.created_by)
    if (req.user!.role === 'admin' && req.user!._id !== creatorId) {
      emitTeamEvent({
        event_type: 'team.updated_by_admin',
        actor_id: req.user!._id,
        target_user_id: creatorId,
        team_id: req.params.id as string,
      }).catch(console.error)
    }

    res.json(team)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/teams/:id — delete team, reject if has members or seats (owner or admin)
router.delete('/:id', authenticate, validateObjectId('id'), requireTeamOwnerOrAdmin, async (req, res) => {
  try {
    const teamId = req.params.id as string

    const [userCount, seatCount] = await Promise.all([
      User.countDocuments({ team_ids: teamId }),
      Seat.countDocuments({ team_id: teamId }),
    ])

    if (userCount > 0 || seatCount > 0) {
      res.status(400).json({ error: 'Cannot delete team with existing members or seats' })
      return
    }

    const teamToDelete = req.team!
    await Team.findByIdAndDelete(teamId)

    // Notify creator after successful deletion
    emitTeamEvent({
      event_type: 'team.deleted_by_admin',
      actor_id: req.user!._id,
      target_user_id: String(teamToDelete.created_by),
      team_id: teamId,
    }).catch(console.error)

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/teams/:id/members — add user to team (owner or admin)
router.post('/:id/members', authenticate, validateObjectId('id'), requireTeamOwnerOrAdmin, async (req, res) => {
  try {
    const { user_id } = req.body
    if (!user_id || !mongoose.Types.ObjectId.isValid(user_id)) {
      res.status(400).json({ error: 'Valid user_id is required' })
      return
    }

    const user = await User.findById(user_id)
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    await User.findByIdAndUpdate(user_id, {
      $addToSet: { team_ids: new mongoose.Types.ObjectId(req.params.id as string) },
    })

    emitTeamEvent({
      event_type: 'team.member_added',
      actor_id: req.user!._id,
      target_user_id: user_id,
      team_id: req.params.id as string,
    }).catch(console.error)

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/teams/:id/members/:uid — remove user from team (owner or admin)
router.delete('/:id/members/:uid', authenticate, validateObjectId('id'), requireTeamOwnerOrAdmin, async (req, res) => {
  try {
    const uid = req.params.uid as string
    if (!mongoose.Types.ObjectId.isValid(uid)) {
      res.status(400).json({ error: 'Invalid user ID' })
      return
    }

    await User.findByIdAndUpdate(uid, {
      $pull: { team_ids: new mongoose.Types.ObjectId(req.params.id as string) },
    })

    emitTeamEvent({
      event_type: 'team.member_removed',
      actor_id: req.user!._id,
      target_user_id: uid,
      team_id: req.params.id as string,
    }).catch(console.error)

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/teams/:id/seats — add seat to team (owner or admin)
router.post('/:id/seats', authenticate, validateObjectId('id'), requireTeamOwnerOrAdmin, async (req, res) => {
  try {
    const { seat_id } = req.body
    if (!seat_id || !mongoose.Types.ObjectId.isValid(seat_id)) {
      res.status(400).json({ error: 'Valid seat_id is required' })
      return
    }

    const seat = await Seat.findById(seat_id)
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    // Non-admin: can only add own seats
    if (req.user!.role !== 'admin' && seat.owner_id?.toString() !== req.user!._id) {
      res.status(403).json({ error: 'Can only add your own seats to your team' })
      return
    }

    await Seat.findByIdAndUpdate(seat_id, { team_id: req.params.id as string })

    // Notify seat owner if admin reassigned their seat
    if (seat.owner_id && req.user!.role === 'admin') {
      emitTeamEvent({
        event_type: 'team.seat_reassigned',
        actor_id: req.user!._id,
        target_user_id: String(seat.owner_id),
        team_id: req.params.id as string,
        extra: { seat_id, seat_email: seat.email },
      }).catch(console.error)
    }

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/teams/:id/seats/:sid — remove seat from team (owner or admin)
router.delete('/:id/seats/:sid', authenticate, validateObjectId('id'), requireTeamOwnerOrAdmin, async (req, res) => {
  try {
    const sid = req.params.sid as string
    if (!mongoose.Types.ObjectId.isValid(sid)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

    const seat = await Seat.findById(sid)
    if (!seat || String(seat.team_id) !== (req.params.id as string)) {
      res.status(404).json({ error: 'Seat not in this team' })
      return
    }

    await Seat.findByIdAndUpdate(sid, { team_id: null })
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
