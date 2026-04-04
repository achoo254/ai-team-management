import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { config } from './config.js'

export interface JwtPayload {
  _id: string
  name: string
  email: string
  role: 'admin' | 'user'
  team?: string | null
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
