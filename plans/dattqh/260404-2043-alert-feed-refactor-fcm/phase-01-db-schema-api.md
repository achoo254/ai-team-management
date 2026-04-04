# Phase 1: DB Schema + API Changes

## Overview
- **Priority**: High (foundation for all other phases)
- **Status**: pending
- **Effort**: M

## Context Links
- [Plan Overview](./plan.md)
- [Brainstorm Report](../reports/brainstorm-260404-2043-alert-feed-refactor-fcm.md)

## Key Insights
- Current `resolved`/`resolved_by`/`resolved_at` fields → replace with `read_by: ObjectId[]` for per-user read tracking
- Alert dedup index `{ seat_id, type, resolved }` → change to `{ seat_id, type, created_at }` (no resolved concept)
- `insertIfNew()` in alert-service uses `resolved: false` for upsert → change to time-based dedup only (1h cooldown already exists)
- `cleanupExpiredSessions()` auto-resolves `usage_exceeded` alerts → remove that logic

## Related Code Files

### Files to modify
- `packages/api/src/models/alert.ts` — schema change
- `packages/api/src/models/user.ts` — add `fcm_tokens` field
- `packages/api/src/routes/alerts.ts` — replace resolve endpoint, add mark-read, add scope filtering
- `packages/api/src/services/alert-service.ts` — remove resolved-based upsert, update dedup
- `packages/shared/types.ts` — update Alert type, add new metadata fields

## Implementation Steps

### 1. Update Alert Model (`packages/api/src/models/alert.ts`)

```typescript
// Remove: resolved, resolved_by, resolved_at
// Add: read_by
export interface IAlert extends Document {
  seat_id: Types.ObjectId
  type: AlertType
  message: string
  metadata: Record<string, unknown>
  read_by: Types.ObjectId[]  // user IDs who have read this alert
  created_at: Date
}

// Schema changes:
// - Remove: resolved, resolved_by, resolved_at fields
// - Add: read_by: [{ type: Schema.Types.ObjectId, ref: 'User' }]
// - Update index: { seat_id: 1, type: 1, created_at: -1 }
// - Add index: { read_by: 1 } (for unread queries)
// - Add index: { created_at: -1 } (for feed sorting)
```

### 2. Update User Model (`packages/api/src/models/user.ts`)

```typescript
// Add to IUser:
fcm_tokens: string[]  // FCM device tokens for push notifications
push_enabled: boolean  // toggle for desktop push

// Schema addition:
fcm_tokens: { type: [String], default: [] }
push_enabled: { type: Boolean, default: false }
```

### 3. Rewrite Alert Routes (`packages/api/src/routes/alerts.ts`)

**GET /api/alerts** — feed-style with scope filtering
```typescript
// Query params: ?type=rate_limit&seat=<id>&before=<iso>&limit=50
// Admin: all alerts
// Member: only alerts where seat_id is in user's watched_seat_ids
// Sort: created_at DESC
// Populate seat_id with email, label
// Return: { alerts: Alert[], has_more: boolean }
```

**POST /api/alerts/mark-read** — mark alerts as read for current user
```typescript
// Body: { alert_ids: string[] }
// Action: $addToSet read_by with current user ID
// Returns: { updated: number }
```

**GET /api/alerts/unread-count** — for bell badge
```typescript
// Admin: count where read_by does not contain user ID
// Member: count where seat_id in watched_seat_ids AND read_by does not contain user ID
// Returns: { count: number }
```

**DELETE resolve endpoint** — remove PUT /:id/resolve entirely

### 4. Update Alert Service (`packages/api/src/services/alert-service.ts`)

Changes to `insertIfNew()`:
```typescript
// Remove: resolved-based upsert logic
// Keep: 1h cooldown check (time-based dedup)
// Change to simple insert:
async function insertIfNew(...) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentAlert = await Alert.findOne({
    seat_id: seatId, type, created_at: { $gte: oneHourAgo },
  })
  if (recentAlert) return false

  await Alert.create({ seat_id: seatId, type, message, metadata, read_by: [] })
  await notifySubscribedUsers(seatId, type, seatLabel, metadata, triggerValue)
  return true
}
```

Changes to `cleanupExpiredSessions()`:
```typescript
// Remove: Alert.updateMany auto-resolve logic for usage_exceeded
// Session cleanup still persists metrics and deletes ActiveSession
```

### 5. Update Shared Types (`packages/shared/types.ts`)

```typescript
// Update Alert interface:
export interface Alert {
  _id: string
  seat_id: string | { _id: string; email: string; label: string }
  type: AlertType
  message: string
  metadata?: AlertMetadata
  read_by?: string[]
  created_at: string
}

// Extend AlertMetadata with missing fields:
export interface AlertMetadata {
  session?: '5h' | '7d' | '7d_sonnet' | '7d_opus'
  pct?: number
  credits_used?: number
  credits_limit?: number
  error?: string
  delta?: number
  budget?: number
  user_id?: string
  user_name?: string
  current_7d?: number
  projected?: number
  remaining_sessions?: number
  duration?: number
  resets_at?: string
  next_user?: boolean
}

// Add FCM-related to User:
// fcm_tokens not exposed to client (security)
// push_enabled: boolean — exposed in UserSettings
```

## Todo List
- [ ] Update Alert model schema (remove resolved, add read_by)
- [ ] Update Alert model indexes
- [ ] Add fcm_tokens + push_enabled to User model
- [ ] Rewrite GET /api/alerts with scope filtering + pagination
- [ ] Add POST /api/alerts/mark-read endpoint
- [ ] Add GET /api/alerts/unread-count endpoint
- [ ] Remove PUT /api/alerts/:id/resolve endpoint
- [ ] Update insertIfNew() to simple insert with cooldown
- [ ] Remove auto-resolve logic from cleanupExpiredSessions()
- [ ] Update shared types (Alert, AlertMetadata, UserSettings)
- [ ] Run `pnpm build` to verify compilation

## Success Criteria
- Alerts stored without resolved concept
- Per-user read tracking via read_by array
- Unread count endpoint works correctly per role
- Alert-service creates alerts with simple insert + cooldown
- No compilation errors across all packages

## Risk Assessment
- **Data migration**: Existing alerts have resolved fields → they'll be ignored (Mongoose strips unknown fields on read). Old data safe
- **Index change**: Drop old index, create new → brief period during deploy. Low risk for internal tool
- **Dedup change**: Removing resolved-based upsert means multiple alerts per seat+type can exist (cooldown still prevents spam). This is desired for feed-style

## Security Considerations
- `fcm_tokens` must NOT be exposed in API responses (like telegram_bot_token)
- mark-read only adds current user's ID (no spoofing other users)
- Scope filtering prevents non-admin users from seeing alerts for seats they don't watch
