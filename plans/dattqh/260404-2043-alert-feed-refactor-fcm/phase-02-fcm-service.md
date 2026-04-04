# Phase 2: FCM Service Setup

## Overview
- **Priority**: High (needed before client integration)
- **Status**: pending
- **Effort**: M

## Context Links
- [Plan Overview](./plan.md)
- [Phase 1: DB Schema](./phase-01-db-schema-api.md) — depends on User model fcm_tokens field

## Key Insights
- Firebase Admin SDK already initialized in `packages/api/src/firebase-admin.ts` (for Auth)
- Just need to add `getMessaging()` export — no new SDK needed
- `firebase-admin` package already in api dependencies
- FCM sends parallel with Telegram in `notifySubscribedUsers()` — same pattern
- FCM tokens can expire → handle `messaging/registration-token-not-registered` error

## Related Code Files

### Files to modify
- `packages/api/src/firebase-admin.ts` — add messaging export
- `packages/api/src/services/alert-service.ts` — add FCM send in notifySubscribedUsers
- `packages/api/src/routes/user-settings.ts` — add FCM token register/unregister endpoints

### Files to create
- `packages/api/src/services/fcm-service.ts` — FCM send logic + token cleanup

## Implementation Steps

### 1. Extend Firebase Admin (`packages/api/src/firebase-admin.ts`)

```typescript
// Add export:
export function getMessaging(): admin.messaging.Messaging {
  return getFirebaseAdmin().messaging()
}
```

### 2. Create FCM Service (`packages/api/src/services/fcm-service.ts`)

```typescript
import { getMessaging } from '../firebase-admin.js'
import { User } from '../models/user.js'
import type { AlertType } from '@repo/shared/types'

// Alert type → notification config
const ALERT_DISPLAY: Record<AlertType, { title: string; icon: string }> = {
  rate_limit: { title: '🔴 Rate Limit Warning', icon: 'rate_limit' },
  extra_credit: { title: '💳 Extra Credit Warning', icon: 'extra_credit' },
  token_failure: { title: '⚠️ Token Failure', icon: 'token_failure' },
  usage_exceeded: { title: '🚫 Usage Budget Exceeded', icon: 'usage_exceeded' },
  session_waste: { title: '⚠️ Session lãng phí', icon: 'session_waste' },
  '7d_risk': { title: '🔴 7d Usage Risk', icon: '7d_risk' },
}

/** Send FCM push to a user's registered devices */
export async function sendPushToUser(
  userId: string,
  type: AlertType,
  seatLabel: string,
  message: string,
  alertId: string,
) {
  const user = await User.findById(userId, 'fcm_tokens push_enabled')
  if (!user?.push_enabled || !user.fcm_tokens?.length) return

  const display = ALERT_DISPLAY[type]
  const messaging = getMessaging()
  const staleTokens: string[] = []

  // Send to each registered device
  await Promise.allSettled(
    user.fcm_tokens.map(async (token) => {
      try {
        await messaging.send({
          token,
          notification: {
            title: display.title,
            body: `${seatLabel}: ${message}`,
          },
          data: {
            type,
            alertId,
            url: '/alerts',
          },
          webpush: {
            fcmOptions: { link: '/alerts' },
          },
        })
      } catch (err: any) {
        // Token expired or invalid → mark for cleanup
        if (err?.code === 'messaging/registration-token-not-registered'
          || err?.code === 'messaging/invalid-registration-token') {
          staleTokens.push(token)
        } else {
          console.error(`[FCM] Send failed for user ${userId}:`, err?.message)
        }
      }
    }),
  )

  // Cleanup stale tokens
  if (staleTokens.length > 0) {
    await User.updateOne(
      { _id: userId },
      { $pull: { fcm_tokens: { $in: staleTokens } } },
    )
  }
}

/** Send FCM push to multiple users (used by alert-service) */
export async function sendPushToUsers(
  userIds: string[],
  type: AlertType,
  seatLabel: string,
  message: string,
  alertId: string,
) {
  await Promise.allSettled(
    userIds.map((uid) => sendPushToUser(uid, type, seatLabel, message, alertId)),
  )
}
```

### 3. Update Alert Service (`packages/api/src/services/alert-service.ts`)

In `notifySubscribedUsers()`, add FCM send parallel with Telegram:
```typescript
import { sendPushToUsers } from './fcm-service.js'

async function notifySubscribedUsers(seatId, type, seatLabel, metadata, triggerValue) {
  // ... existing user filtering logic ...

  // Get the alert ID for FCM data payload
  const alert = await Alert.findOne({ seat_id: seatId, type }).sort({ created_at: -1 })
  const alertId = alert ? String(alert._id) : ''

  // Send both channels in parallel
  await Promise.allSettled([
    // Telegram (existing)
    ...eligible
      .filter(u => u.telegram_bot_token && u.telegram_chat_id)
      .map(u => sendAlertToUser(u, type, seatLabel, metadata)),
    // FCM Push (new)
    sendPushToUsers(
      eligible.filter(u => u.push_enabled && u.fcm_tokens?.length).map(u => String(u._id)),
      type, seatLabel, alert?.message ?? '', alertId,
    ),
  ])
}
```

### 4. Add FCM Token Endpoints (`packages/api/src/routes/user-settings.ts`)

```typescript
// POST /api/user/settings/fcm-token — register FCM token
router.post('/settings/fcm-token', async (req, res) => {
  const { token } = req.body
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Token required' })
    return
  }

  // $addToSet prevents duplicates, limit to 10 devices
  const user = await User.findById(req.user!._id, 'fcm_tokens')
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  if ((user.fcm_tokens?.length ?? 0) >= 10) {
    // Remove oldest token to make room
    await User.updateOne({ _id: req.user!._id }, { $pop: { fcm_tokens: -1 } })
  }
  await User.updateOne({ _id: req.user!._id }, { $addToSet: { fcm_tokens: token } })
  res.json({ success: true })
})

// DELETE /api/user/settings/fcm-token — unregister FCM token
router.delete('/settings/fcm-token', async (req, res) => {
  const { token } = req.body
  if (!token) { res.status(400).json({ error: 'Token required' }); return }

  await User.updateOne({ _id: req.user!._id }, { $pull: { fcm_tokens: token } })
  res.json({ success: true })
})
```

Also add `push_enabled` to the existing PUT /settings handler:
```typescript
// In PUT /api/user/settings body handling:
if (push_enabled !== undefined) {
  user.push_enabled = !!push_enabled
}
```

And expose in GET /settings response:
```typescript
push_enabled: user.push_enabled ?? false,
```

## Todo List
- [ ] Add getMessaging() to firebase-admin.ts
- [ ] Create fcm-service.ts with sendPushToUser + sendPushToUsers
- [ ] Update notifySubscribedUsers() to send FCM parallel with Telegram
- [ ] Add POST /api/user/settings/fcm-token endpoint
- [ ] Add DELETE /api/user/settings/fcm-token endpoint
- [ ] Add push_enabled to GET/PUT /api/user/settings
- [ ] Update User model query in notifySubscribedUsers to include fcm_tokens, push_enabled
- [ ] Run `pnpm build` to verify compilation

## Success Criteria
- FCM service sends push notifications to registered devices
- Stale tokens auto-cleaned on send failure
- Token registration endpoint works with 10-device cap
- FCM sends parallel with Telegram (non-blocking)
- No compilation errors

## Risk Assessment
- **Firebase config**: Service account may not have FCM permissions → need to enable Cloud Messaging API in Firebase console
- **Token cap**: 10 devices per user — generous for internal tool
- **Rate limits**: Firebase FCM has generous free tier (no concern for internal tool)

## Security Considerations
- FCM tokens not exposed in API GET responses (strip in toJSON)
- Token registration requires authentication
- No user impersonation possible (token tied to browser, not user-chosen)
