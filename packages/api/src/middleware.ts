import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { config } from './config.js'
import { Seat } from './models/seat.js'
import { User } from './models/user.js'

export interface JwtPayload {
  _id: string
  name: string
  email: string
  role: 'admin' | 'user'
}

// Extend Express Request with typed user property
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  // Try Authorization Bearer header first
  const authHeader = req.headers.authorization
  let token: string | undefined
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }
  // Fall back to cookie
  if (!token) {
    token = req.cookies?.token
  }
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  try {
    req.user = jwt.verify(token, config.jwtSecret) as JwtPayload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}

/** Allows only seat owner to proceed (no admin bypass). Must be used after `authenticate`. */
export function requireSeatOwner(paramName = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    const seat = await Seat.findById(req.params[paramName])
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }
    if (seat.owner_id?.toString() !== req.user._id) {
      res.status(403).json({ error: 'Not seat owner' })
      return
    }
    next()
  }
}

/** Allows admin or seat owner to proceed. Must be used after `authenticate`. */
export function requireSeatOwnerOrAdmin(paramName = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }
    if (req.user.role === 'admin') return next()

    const seat = await Seat.findById(req.params[paramName])
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }
    if (seat.owner_id?.toString() !== req.user._id) {
      res.status(403).json({ error: 'Not seat owner' })
      return
    }
    next()
  }
}

/** Get seat IDs user owns or is assigned to. Returns null for admin (= no filter). */
export async function getAllowedSeatIds(user: JwtPayload): Promise<mongoose.Types.ObjectId[] | null> {
  if (user.role === 'admin') return null
  const [dbUser, ownedSeats] = await Promise.all([
    User.findById(user._id, 'seat_ids').lean(),
    Seat.find({ owner_id: user._id }, '_id').lean(),
  ])
  const assigned = (dbUser?.seat_ids ?? []).map((id) => new mongoose.Types.ObjectId(String(id)))
  const owned = ownedSeats.map((s) => new mongoose.Types.ObjectId(String(s._id)))
  const map = new Map<string, mongoose.Types.ObjectId>()
  for (const id of [...assigned, ...owned]) map.set(String(id), id)
  return [...map.values()]
}

export function validateObjectId(paramName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName] as string
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: `Invalid ${paramName}` })
      return
    }
    next()
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' })
}

/** Global error handler — mount last on the Express app */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[API Error]', err)
  // Mongoose duplicate key
  if ('code' in err && (err as unknown as { code: number }).code === 11000) {
    res.status(409).json({ error: 'Đã tồn tại' })
    return
  }
  const isDev = process.env.NODE_ENV !== 'production'
  res.status(500).json({ error: isDev ? err.message : 'Internal server error' })
}
