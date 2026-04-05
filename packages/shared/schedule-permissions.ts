import type { SchedulePermissions } from './types.js'

export interface PermissionContext {
  userId: string
  userRole: 'admin' | 'user'
  seatOwnerId: string | null
  userSeatIds: string[] // seats this user belongs to
  seatId: string        // the seat being viewed
}

/** Pure permission resolver — no DB calls, works in both Node.js and browser */
export function resolveSchedulePermissions(ctx: PermissionContext): SchedulePermissions {
  const isAdmin = ctx.userRole === 'admin'
  const isOwner = ctx.seatOwnerId != null && ctx.seatOwnerId === ctx.userId
  const isMember = ctx.userSeatIds.includes(ctx.seatId)

  return {
    canView: isAdmin || isOwner || isMember,
    canManage: isAdmin,
  }
}
