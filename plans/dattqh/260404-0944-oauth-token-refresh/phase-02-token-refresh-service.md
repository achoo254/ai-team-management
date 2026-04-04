---
phase: 2
status: done
priority: high
depends_on: [phase-01]
---

# Phase 2: Token Refresh Service & Cron

## Overview
New service to auto-refresh expiring OAuth tokens. Cron job every 5min. Update usage-collector to read from new subdocument. Telegram alert on refresh failure.

## Related Code Files
- **Create:** `packages/api/src/services/token-refresh-service.ts`
- **Modify:** `packages/api/src/services/usage-collector-service.ts`
- **Modify:** `packages/api/src/index.ts`
- **Modify:** `packages/api/src/services/telegram-service.ts`

## Implementation Steps

### 1. Create `token-refresh-service.ts`

```typescript
// packages/api/src/services/token-refresh-service.ts
import { Seat } from '../models/seat.js'
import { encrypt, decrypt } from './crypto-service.js'
import { sendTokenRefreshAlert } from './telegram-service.js'

const REFRESH_URL = 'https://api.anthropic.com/v1/oauth/token'
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
const EXPIRY_BUFFER_MS = 5 * 60 * 1000  // 5 minutes
const FETCH_TIMEOUT_MS = 15_000
const CONCURRENCY = 3
const MAX_ERROR_LENGTH = 200
```

**Core functions:**

#### `refreshTokenForSeat(seat)`
1. Decrypt `seat.oauth_credential.refresh_token`
2. POST to `REFRESH_URL` with body:
   ```json
   {
     "grant_type": "refresh_token",
     "refresh_token": "<decrypted>",
     "client_id": "9d1c250a-e61b-44d9-88ed-5944d1962f5e"
   }
   ```
   Headers: `Content-Type: application/json`
3. On success (200):
   - Response: `{ access_token, refresh_token, expires_in, scope, ... }`
   - Compute `expires_at = Date.now() + expires_in * 1000`
   - Encrypt new access_token and refresh_token
   - Update seat:
     ```typescript
     await Seat.findByIdAndUpdate(seat._id, {
       'oauth_credential.access_token': encrypt(response.access_token),
       'oauth_credential.refresh_token': encrypt(response.refresh_token),
       'oauth_credential.expires_at': new Date(expires_at),
       'oauth_credential.scopes': response.scope.split(' '),
       last_refreshed_at: new Date(),
       last_fetch_error: null,
     })
     ```
4. On failure:
   - Set `token_active: false`
   - Save error to `last_fetch_error`
   - Send Telegram alert

#### `checkAndRefreshExpiring()`
1. Find seats where:
   - `token_active: true`
   - `oauth_credential.refresh_token` exists (not null)
   - `oauth_credential.expires_at < Date.now() + EXPIRY_BUFFER_MS`
2. Use `parallelLimit` (reuse from usage-collector or extract to shared util) with CONCURRENCY=3
3. Call `refreshTokenForSeat` for each
4. Return `{ refreshed: number, errors: number }`

**Mutex guard:** `let isRefreshing = false` — prevent overlapping cron runs (same pattern as usage-collector).

### 2. Add Telegram Alert Function

In `telegram-service.ts`, add:

```typescript
export async function sendTokenRefreshAlert(seatLabel: string, error: string) {
  if (!config.telegram.botToken || !config.telegram.chatId) return
  const msg = `⚠️ <b>Token refresh failed</b>\n\n`
    + `Seat: <b>${esc(seatLabel)}</b>\n`
    + `Error: <code>${esc(error.slice(0, 200))}</code>\n\n`
    + `Token đã bị deactivate. Vui lòng re-import credential.`
  await sendMessage(msg)
}
```

**Note:** Need to export `sendMessage` or make `sendTokenRefreshAlert` call it directly. Currently `sendMessage` is private. Simplest: add the new function in the same file, it can call `sendMessage` directly (same module).

### 3. Update `usage-collector-service.ts`

Change `fetchSeatUsage` to read from new structure:
- Before: `seat.access_token` (flat field)
- After: `seat.oauth_credential.access_token` (subdocument)

Update `collectAllUsage` query:
```typescript
// Before
const seats = await Seat.find({
  token_active: true,
  access_token: { $ne: null },
}).select('+access_token').lean()

// After
const seats = await Seat.find({
  token_active: true,
  'oauth_credential.access_token': { $ne: null },
}).select('+oauth_credential').lean()
```

Update `fetchSeatUsage` signature:
```typescript
// Before: seat.access_token
const token = decrypt(seat.access_token)
// After: seat.oauth_credential.access_token
const token = decrypt(seat.oauth_credential!.access_token!)
```

Same changes for `collectSeatUsage`.

### 4. Extract `parallelLimit` to Shared Utility

Both `usage-collector-service` and `token-refresh-service` need `parallelLimit`. Extract to `packages/api/src/utils/parallel-limit.ts`:

```typescript
export async function parallelLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing: Promise<void>[] = []
  for (const item of items) {
    const p = fn(item).then(() => { executing.splice(executing.indexOf(p), 1) })
    executing.push(p)
    if (executing.length >= limit) await Promise.race(executing)
  }
  await Promise.all(executing)
}
```

Import in both services.

### 5. Register Cron in `index.ts`

```typescript
import { checkAndRefreshExpiring } from './services/token-refresh-service.js'

// Cron: Every 5 min — check and refresh expiring tokens
cron.schedule('*/5 * * * *', () => {
  console.log('[Cron] Checking token expiry...')
  checkAndRefreshExpiring().catch(console.error)
}, { timezone: 'Asia/Ho_Chi_Minh' })
```

## Todo
- [ ] Create `packages/api/src/services/token-refresh-service.ts`
- [ ] Implement `refreshTokenForSeat()` with Anthropic OAuth API call
- [ ] Implement `checkAndRefreshExpiring()` with expiry buffer check
- [ ] Add `sendTokenRefreshAlert()` to telegram-service.ts
- [ ] Update usage-collector-service.ts to use oauth_credential subdocument
- [ ] Extract `parallelLimit` to `packages/api/src/utils/parallel-limit.ts`
- [ ] Register 5-min cron in index.ts
- [ ] Compile check: `pnpm build`

## Security Considerations
- Refresh token encrypted same as access token (AES-256-GCM)
- client_id hardcoded (not sensitive — public OAuth client ID)
- Telegram alert does not include token values

## Success Criteria
- Tokens auto-refresh 5min before expiry
- Failed refresh → token_active=false + Telegram alert
- Usage collector works with new subdocument structure
- No overlapping refresh/collect cron runs
