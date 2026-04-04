# Phase 3: Settings API & Telegram Notifications

## Priority: Medium | Status: completed

## Overview
Create settings CRUD route for admin UI. Add Telegram notification function for individual alerts.

## Files to Create
- `packages/api/src/routes/settings.ts` — GET/PUT /api/settings

## Files to Modify
- `packages/api/src/index.ts` — Mount settings route
- `packages/api/src/services/telegram-service.ts` — Add sendAlertNotification function
- `packages/api/src/services/alert-service.ts` — Call Telegram after creating alert

## Implementation Steps

### 1. Create `routes/settings.ts`

```ts
// GET /api/settings — authenticated, returns current settings
// PUT /api/settings — admin only, updates alert thresholds
//   Body: { alerts: { rate_limit_pct?: number, extra_credit_pct?: number } }
//   Validate: 0 < pct <= 100
//   Uses Setting.findOneAndUpdate with upsert
```

### 2. Mount in `index.ts`

```ts
import settingsRoutes from './routes/settings.js'
app.use('/api/settings', settingsRoutes)
```

### 3. Add `sendAlertNotification` in telegram-service.ts

Three message templates based on alert type:

**rate_limit:**
```
🔴 <b>Rate Limit Warning</b>
Seat: <b>{label}</b>
Window: {window} | Usage: {pct}%
Ngưỡng: {threshold}%
```

**extra_credit:**
```
💳 <b>Extra Credit Warning</b>
Seat: <b>{label}</b>
Credits: ${used}/${limit} ({pct}%)
Ngưỡng: {threshold}%
```

**token_failure:**
```
⚠️ <b>Token Failure</b>
Seat: <b>{label}</b>
Error: <code>{error}</code>
→ Cần re-import credential
```

Function signature:
```ts
export async function sendAlertNotification(
  type: AlertType,
  seatLabel: string,
  metadata: AlertMetadata,
  threshold?: number,
): Promise<void>
```

Silently skip if Telegram not configured (don't throw).

### 4. Call from alert-service.ts

After each successful `insertIfNew()`, call `sendAlertNotification()`. Wrap in try-catch — Telegram failure should not block alert creation.

## Todo
- [x] Create routes/settings.ts with GET/PUT
- [x] Mount settings route in index.ts
- [x] Add sendAlertNotification to telegram-service.ts
- [x] Integrate Telegram call in alert-service.ts
- [x] Run `pnpm build` to verify

## Success Criteria
- GET /api/settings returns defaults on first call
- PUT /api/settings updates thresholds (admin only)
- Telegram message sent for each new alert
- Telegram failure doesn't block alert creation
