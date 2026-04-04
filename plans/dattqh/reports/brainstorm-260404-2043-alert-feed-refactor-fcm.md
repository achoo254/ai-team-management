# Brainstorm: Alert Feed Refactor + FCM Push Notification

**Date:** 2026-04-04 20:43
**Status:** Approved — ready for implementation plan

## Problem Statement

Current alert page shows Telegram notifications + manual "Xử lý" (resolve) button. User finds this useless because:
- "Xử lý" = just marks as read, no real action
- Members without Telegram config receive nothing
- Only 3/6 alert types rendered in UI (missing usage_exceeded, session_waste, 7d_risk)
- Metadata not fully displayed (delta, budget, projected available but hidden)

## Agreed Design

### 1. Alert Feed UI Refactor

| Decision | Choice |
|---|---|
| Lifecycle | Feed-style chronological log, no resolve concept |
| Tabs | Remove "Chưa xử lý / Đã xử lý" → filter by type/seat/date |
| Alert card | Expandable — click to show inline usage bars + full metadata |
| Grouping | By date (Today / Yesterday / Earlier) |
| Views | Same layout, different scope: Admin=all seats, Member=watched_seat_ids |
| DB resolved field | Repurpose as `read` tracking — `read_by: userId[]` for badge count |

**Expandable card content (per alert type):**
- `rate_limit`: All session bars (5h/7d/sonnet/opus) + reset timer + trend
- `extra_credit`: Credits used/limit + percentage bar
- `token_failure`: Error message + seat status
- `usage_exceeded`: User name + delta vs budget bar
- `session_waste`: Duration vs usage percentage
- `7d_risk`: Current 7d + projected + remaining sessions

### 2. In-app Notification Bell

- Header bar: Bell icon + unread badge count
- Click → dropdown popup: 5 most recent alerts + "Xem tất cả" link
- Unread = alerts where userId NOT in `read_by` array
- Click dropdown item → navigate /alerts + mark as read
- Always on, cannot disable

### 3. FCM Desktop Push Notification

- **Channel strategy**: FCM + Telegram + In-app — 3 independent channels, each toggle on/off
- **Firebase status**: Auth only configured, FCM needs full setup
- **Setup needed**:
  - firebase-messaging-sw.js (service worker)
  - vapidKey generation
  - Permission request UX
  - FCM token storage in user model (`fcm_tokens: string[]` for multi-device)
- **Backend**: firebase-admin.messaging().send() parallel with Telegram
- **User settings**: Toggle "Desktop Push" independently

### Notification Flow

```
Alert created (alert-service)
    ├─► In-app: Save to DB → bell badge auto-update (query invalidation)
    ├─► FCM Push: user.fcm_tokens → firebase-admin.messaging().send()
    └─► Telegram: user.telegram_bot_token → sendAlertToUser()
```

Each channel only sends if user has it configured + enabled.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| FCM token expire/revoke | Handle `messaging/registration-token-not-registered`, cleanup stale tokens |
| Multi-device tokens | `fcm_tokens: string[]` array, cap at 10 devices |
| Browser deny notification permission | Prompt at right moment (after first alert), show in-app fallback guidance |
| `read_by` array query perf | Index on `read_by`, consider TTL or pagination for old alerts |
| Breaking change (resolve removal) | Migrate existing resolved alerts, keep data, just change UI |

## Files Impacted

**API:**
- `models/alert.ts` — add `read_by` field, remove resolve fields
- `models/user.ts` — add `fcm_tokens`, `push_enabled` fields
- `routes/alerts.ts` — remove resolve endpoint, add mark-read endpoint, filter by user scope
- `routes/user-settings.ts` — add FCM token registration endpoint
- `services/alert-service.ts` — add FCM send parallel with Telegram
- `services/telegram-service.ts` — minor refactor for multi-channel
- New: `services/fcm-service.ts` — FCM send logic

**Web:**
- `pages/alerts.tsx` — feed-style layout, date grouping, filters
- `components/alert-card.tsx` — expandable card with inline usage detail
- New: `components/notification-bell.tsx` — header bell icon + dropdown
- `components/alert-settings-form.tsx` — add push notification toggle
- `hooks/use-alerts.ts` — update types, add mark-read mutation, remove resolve
- `hooks/use-user-settings.ts` — add FCM token management
- `lib/firebase-client.ts` — add FCM messaging init
- New: `public/firebase-messaging-sw.js` — service worker

**Shared:**
- `types.ts` — update Alert type (read_by), add FCM-related types

## Next Steps

Create implementation plan via `/ck:plan`.
