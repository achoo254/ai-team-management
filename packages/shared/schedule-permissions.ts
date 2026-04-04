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

  if (!isAdmin && !isOwner && !isMember) {
    return {
      canView: false, canCreate: false, canCreateForOthers: false,
      canSwap: false, canClearAll: false,
      canEditEntry: () => false, canDeleteEntry: () => false,
    }
  }

  return {
    canView: true,
    canCreate: true,
    canCreateForOthers: isAdmin || isOwner,
    canSwap: isAdmin || isOwner,
    canClearAll: isAdmin,
    canEditEntry: (entry) => isAdmin || isOwner || entry.user_id === ctx.userId,
    canDeleteEntry: (entry) => isAdmin || isOwner || entry.user_id === ctx.userId,
  }
}
