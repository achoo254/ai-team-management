---
name: Alert Feed Refactor + FCM Push + In-app Notification
status: pending
created: 2026-04-04
branch: main
phases: 5
blockedBy: []
blocks: []
---

# Alert Feed Refactor + FCM Push + In-app Notification

## Context
- [Brainstorm Report](../reports/brainstorm-260404-2043-alert-feed-refactor-fcm.md)
- Builds on completed [Alert System Redesign](../260404-1029-alert-system-redesign/plan.md)
- Builds on completed [Refactor Alert → User Settings](../260404-1754-refactor-alert-to-user-settings/plan.md)

## Problem
1. Alert page = passive info display + useless "Xử lý" button (just marks read)
2. Only 3/6 alert types rendered in UI (missing usage_exceeded, session_waste, 7d_risk)
3. Metadata not fully displayed (delta, budget, projected data exists but hidden)
4. Members without Telegram receive nothing — no alternative notification channel
5. No in-app notification system — must navigate to /alerts manually

## Solution
Three features working together:

1. **Alert Feed UI** — Feed-style chronological log, expandable cards, date grouping, role-based scope
2. **In-app Notification Bell** — Header bell icon + dropdown with 5 recent alerts + badge count
3. **FCM Desktop Push** — Firebase Cloud Messaging as parallel channel with Telegram

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [DB Schema + API Changes](./phase-01-db-schema-api.md) | pending | M |
| 2 | [FCM Service Setup](./phase-02-fcm-service.md) | pending | M |
| 3 | [Alert Feed UI Refactor](./phase-03-alert-feed-ui.md) | pending | L |
| 4 | [Notification Bell Component](./phase-04-notification-bell.md) | pending | M |
| 5 | [FCM Client Integration + Settings](./phase-05-fcm-client-settings.md) | pending | M |

## Key Decisions
- `resolved` field → repurpose as `read_by: ObjectId[]` for per-user read tracking
- Remove resolve API endpoint, add mark-read endpoint
- Admin sees all alerts, member sees only watched_seat_ids alerts
- FCM tokens stored as `fcm_tokens: string[]` on User model (multi-device)
- 3 notification channels: In-app (always on) + FCM (toggle) + Telegram (toggle)
- No popover UI component exists → need to add shadcn/ui popover
