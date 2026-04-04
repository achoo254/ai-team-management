---
phase: 3
title: Per-user Telegram Bot Config
status: done
priority: medium
effort: small
depends_on: []
---

# Phase 3: Per-user Telegram Bot Config

## Context Links
- [Plan Overview](plan.md)
- [Brainstorm Report](../reports/brainstorm-260404-1237-schedule-usage-bot-redesign.md)
- Existing telegram service: `packages/api/src/services/telegram-service.ts`
- User model: `packages/api/src/models/user.ts`

## Overview
Allow each user to configure their own Telegram bot token + chat ID for personal notifications. Falls back to system bot when not configured.

## Key Insights
- Current `sendMessage()` uses single system bot from env vars — all notifications go to one group chat
- Per-user bot enables direct personal alerts (critical for usage budget alerts from Phase 2)
- Bot token is sensitive — must encrypt at rest using AES-256-GCM
- Node.js `crypto` module sufficient — no external dependency needed
- Need `ENCRYPTION_KEY` env var (32-byte hex string for AES-256)

## Requirements

### Functional
- User can set `telegram_bot_token` + `telegram_chat_id` in settings UI
- Test button to verify bot config sends a test message
- Notifications check user config first; fallback to system bot
- System bot still receives all notifications (group awareness); per-user bot sends personal copy
- Admin can view (but not read token) which users have bot configured

### Non-Functional
- Bot token never exposed in API responses (masked or omitted)
- Token encrypted at rest in MongoDB
- Settings UI accessible from user profile/nav

## Architecture

### Notification Flow
```
sendNotificationToUser(userId, message):
  1. Load user from DB (with telegram fields)
  2. If user has telegram_bot_token + telegram_chat_id:
     → Decrypt token
     → Send via user's personal bot to user's chat
  3. Always also send via system bot to group chat (existing behavior)
```

### Encryption
```
Encrypt: AES-256-GCM(plaintext_token, ENCRYPTION_KEY) → iv + authTag + ciphertext (stored as hex)
Decrypt: AES-256-GCM(stored_hex, ENCRYPTION_KEY) → plaintext_token
Format in DB: "iv:authTag:ciphertext" (single string, colon-separated hex)
```

## Related Code Files

### Modify
| File | Changes |
|------|---------|
| `packages/api/src/models/user.ts` | Add `telegram_bot_token`, `telegram_chat_id` fields |
| `packages/api/src/services/telegram-service.ts` | Add `sendToUser()` function; refactor `sendMessage()` to accept optional bot config |
| `packages/api/src/config.ts` | Add `ENCRYPTION_KEY` env var |
| `packages/shared/types.ts` | Add `telegram_chat_id`, `has_telegram_bot` to User type |

### Create
| File | Purpose |
|------|---------|
| `packages/api/src/routes/user-settings.ts` | GET/PUT /api/user/settings + POST /api/user/settings/test-bot |
| `packages/api/src/lib/encryption.ts` | `encrypt()` / `decrypt()` utility using AES-256-GCM |
| `packages/web/src/components/bot-settings-form.tsx` | Form: bot token (password input), chat ID, test button |
| `packages/web/src/hooks/use-user-settings.ts` | React Query hooks for user settings API |

## Implementation Steps

### Step 1: Encryption Utility (packages/api/src/lib/encryption.ts)
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { config } from '../config.js'

const ALGORITHM = 'aes-256-gcm'

export function encrypt(text: string): string {
  const key = Buffer.from(config.encryptionKey, 'hex') // 32 bytes
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(stored: string): string {
  const key = Buffer.from(config.encryptionKey, 'hex')
  const [ivHex, authTagHex, encryptedHex] = stored.split(':')
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  return decipher.update(encryptedHex, 'hex', 'utf8') + decipher.final('utf8')
}
```

### Step 2: Config Update (packages/api/src/config.ts)
```typescript
encryptionKey: process.env.ENCRYPTION_KEY || '', // 64-char hex (32 bytes)
```
Validate on startup: if bot features used but key missing → warn.

### Step 3: User Model Update (packages/api/src/models/user.ts)
```typescript
// Add to schema:
telegram_bot_token: { type: String, default: null },  // encrypted
telegram_chat_id: { type: String, default: null },

// Exclude token from default queries:
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.telegram_bot_token
    ret.has_telegram_bot = !!ret.telegram_bot_token && !!ret.telegram_chat_id
    return ret
  },
})
```

### Step 4: Shared Types (packages/shared/types.ts)
```typescript
export interface User {
  // existing...
  telegram_chat_id?: string | null
  has_telegram_bot?: boolean  // computed, never send token to client
}
```

### Step 5: User Settings Route (packages/api/src/routes/user-settings.ts)
```typescript
// GET /api/user/settings — return current user's settings (masked)
// Response: { telegram_chat_id, has_telegram_bot }

// PUT /api/user/settings — update bot config
// Body: { telegram_bot_token?, telegram_chat_id? }
// → encrypt token before saving
// → if token is empty string, clear both fields

// POST /api/user/settings/test-bot — send test message via user's bot
// → decrypt token, send "Test message from Claude Teams Dashboard"
// → return { success: true } or { error: "..." }
```
Register in `index.ts`: `app.use('/api/user', userSettingsRoutes)`

### Step 6: Telegram Service Refactor (packages/api/src/services/telegram-service.ts)
Add `sendToUser()`:
```typescript
/** Send notification to specific user via their personal bot (if configured) + system bot */
export async function sendToUser(userId: string, message: string) {
  // Always send to system bot (group chat)
  await sendMessage(message).catch(console.error)

  // Try user's personal bot
  const user = await User.findById(userId).select('+telegram_bot_token telegram_chat_id')
  if (user?.telegram_bot_token && user?.telegram_chat_id) {
    const token = decrypt(user.telegram_bot_token)
    await sendMessageWithBot(token, user.telegram_chat_id, message).catch(err => {
      console.error(`[Telegram] Personal bot failed for ${userId}:`, err)
    })
  }
}

/** Send via arbitrary bot (extracted from sendMessage) */
async function sendMessageWithBot(botToken: string, chatId: string, text: string) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  if (!res.ok) throw new Error(`Telegram API ${res.status}`)
}
```
Refactor existing `sendMessage()` to use `sendMessageWithBot()` internally.

### Step 7: Frontend Hook (packages/web/src/hooks/use-user-settings.ts)
```typescript
export function useUserSettings() {
  return useQuery({ queryKey: ['user-settings'], queryFn: () => api.get('/api/user/settings') })
}
export function useUpdateUserSettings() { /* mutation PUT */ }
export function useTestBot() { /* mutation POST test-bot */ }
```

### Step 8: Bot Settings Form (packages/web/src/components/bot-settings-form.tsx)
- Password input for bot token (placeholder: "••••••" if has_telegram_bot)
- Text input for chat ID
- Test button (calls test-bot endpoint, shows success/error toast)
- Save button
- "Clear config" button to remove bot setup
- Accessible from user profile menu or dedicated /settings page

### Step 9: Wire Into Phase 2 Alerts
Update `checkBudgetAlerts()` and `notifyNextUser()` to use `sendToUser()` instead of `sendMessage()`:
- Over-budget alert → `sendToUser(currentUserId, alertMsg)`
- Next user notification → `sendToUser(nextUserId, notifyMsg)`

## Todo List
- [x] Create encryption utility (lib/encryption.ts)
- [x] Add ENCRYPTION_KEY to config + .env.example
- [x] Update User model (add telegram fields + toJSON transform)
- [x] Update shared types (User)
- [x] Create user-settings route (GET/PUT/test-bot)
- [x] Register route in index.ts
- [x] Refactor telegram-service: extract sendMessageWithBot, add sendToUser
- [x] Create use-user-settings hook
- [x] Create bot-settings-form component
- [x] Add settings page/section to UI navigation
- [x] Wire Phase 2 alerts to use sendToUser
- [x] Compile check (pnpm build)
- [x] Test: configure bot, send test message, verify personal + system notification

## Success Criteria
- User can configure personal bot token + chat ID
- Test button sends message successfully via user's bot
- Token encrypted in DB, never exposed in API responses
- Alerts send to both personal bot + system bot
- Clearing config falls back cleanly to system bot only
- `pnpm build` passes

## Risk Assessment
| Risk | Mitigation |
|------|------------|
| ENCRYPTION_KEY not set | Graceful degradation: bot config features disabled, warn in logs |
| User provides invalid bot token | Test endpoint validates before saving; catch Telegram API errors |
| Token rotation (ENCRYPTION_KEY changes) | All stored tokens invalidated — users must re-enter. Document in .env.example |
| Personal bot rate limited by Telegram | Catch + log, system bot still delivers |

## Security Considerations
- AES-256-GCM encryption for bot tokens at rest
- `telegram_bot_token` excluded from default User queries via `select`
- toJSON transform strips token, exposes only `has_telegram_bot` boolean
- ENCRYPTION_KEY must be 64-char hex (32 bytes) — validate on startup
- Never log decrypted tokens

## Next Steps
- Generate ENCRYPTION_KEY: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Add to `.env.local` and `.env.example`
