# Code Review: Schedule + Usage Budget + Bot Redesign

**Scope:** 25+ modified/new files across api, web, shared  
**Focus:** Security (encryption, token), correctness (overlap, budget delta), auth  

---

## Overall Assessment

Solid implementation across all 3 phases. Encryption approach is correct (AES-256-GCM, random IV, auth tag). Schedule overlap detection query is well-structured. Budget delta logic is sound. Several issues found — 2 critical, 3 high, rest medium/low.

---

## CRITICAL Issues

### C1. `encrypt()` / `decrypt()` crash when ENCRYPTION_KEY is empty or invalid

**File:** `packages/api/src/lib/encryption.ts:8`

`Buffer.from('', 'hex')` returns an empty buffer. `createCipheriv` will throw a cryptic "Invalid key length" error. While `isEncryptionConfigured()` guards the PUT/POST routes in `user-settings.ts`, `decrypt()` is also called in:
- `telegram-service.ts:251` via `sendToUser()` — no guard
- `user-settings.ts:77` (test-bot) — guarded

If `sendToUser` is ever wired up (currently dead code), it will crash the cron if ENCRYPTION_KEY is unset.

**Fix:** Add early-return guard in `decrypt()`:
```ts
export function decrypt(stored: string): string {
  if (!isEncryptionConfigured()) throw new Error('Encryption not configured')
  // ... rest
}
```

Also: `decrypt()` has no validation on the `stored` input format. If DB has corrupt data (e.g., missing `:` separator), `split(':')` returns fewer than 3 elements, and `Buffer.from(undefined, 'hex')` throws unhelpful error.

**Fix:** Validate split result:
```ts
const parts = stored.split(':')
if (parts.length !== 3) throw new Error('Invalid encrypted data format')
const [ivHex, authTagHex, encryptedHex] = parts
```

### C2. Schedule CRUD has no authorization — any authenticated user can create/edit/delete any schedule

**File:** `packages/api/src/routes/schedules.ts:73,121,196`

POST `/entry`, PUT `/entry/:id`, DELETE `/entry/:id` only require `authenticate` — no `requireAdmin` and no ownership check. Any logged-in user can:
- Create schedules for any user on any seat
- Edit other users' schedule entries
- Delete other users' schedules

Only `swap` and `delete/all` require admin.

**Fix:** Either add `requireAdmin` to POST/PUT/DELETE entry routes, OR add ownership check (`req.user._id === schedule.user_id` for non-admin users).

---

## HIGH Priority

### H1. `endHour` validation allows 23 but `end_hour` is exclusive — impossible to schedule 23:00-24:00

**File:** `packages/api/src/routes/schedules.ts:85`

```ts
if (startHour < 0 || startHour > 23 || endHour < 0 || endHour > 23 || startHour >= endHour)
```

`end_hour` is documented as exclusive (comment in `ISchedule`), but validation caps at 23. A user who wants to schedule 22:00-23:00 cannot set `end_hour=24`. The model schema also has `max: 23`.

**Fix:** Allow `end_hour` up to 24 (exclusive means "up to midnight"). Update schema `max: 24` and validation `endHour > 24`.

### H2. `migrateSlotToHourly()` runs at module import time — races with DB connection

**File:** `packages/api/src/models/schedule.ts:61`

```ts
migrateSlotToHourly().catch(console.error)
```

This fires immediately when the module is imported, potentially before `connectDb()` completes in `index.ts:47`. Mongoose buffers commands, so it may work in practice, but the `dropIndex` call on line 39 also runs at import time outside Mongoose's command buffer.

**Fix:** Move migration + dropIndex calls into an explicit init function called after `connectDb()`.

### H3. `checkBudgetAlerts()` has N+1 query pattern

**File:** `packages/api/src/services/alert-service.ts:124-174`

For each active schedule, the function runs:
1. `ActiveSession.findOne` (1 query per schedule)
2. `UsageSnapshot.findOne` (1 query per schedule)  
3. Possibly `Seat.findById` (1 query per alert)

With 20 schedules active, that's 40-60 DB queries per 5-min cron.

**Fix:** Batch-load active sessions and latest snapshots before the loop:
```ts
const sessions = await ActiveSession.find({ schedule_id: { $in: scheduleIds } })
const sessionMap = new Map(sessions.map(s => [String(s.schedule_id), s]))
// Similar for snapshots
```

---

## MEDIUM Priority

### M1. `sendToUser()` is defined but never called

**File:** `packages/api/src/services/telegram-service.ts:242`

Budget alerts use `sendAlertNotification()` which only sends to the system group bot. The per-user personal bot notification path (`sendToUser`) is unused. Users configure personal bots but never receive personal alerts.

**Action:** Wire `sendToUser` into `checkBudgetAlerts()` for the affected user, or document that personal bot is only for test messages.

### M2. `user-settings.ts:44` — no input validation on `telegram_bot_token`

**File:** `packages/api/src/routes/user-settings.ts:35-49`

The bot token is encrypted and stored without any format validation. A user could store arbitrary strings. Telegram bot tokens follow format `\d+:[A-Za-z0-9_-]+`.

**Fix:** Validate format before encrypting:
```ts
if (telegram_bot_token && !/^\d+:[A-Za-z0-9_-]{35,}$/.test(telegram_bot_token)) {
  res.status(400).json({ error: 'Invalid Telegram bot token format' })
  return
}
```

### M3. Schedule overlap creates entry despite overlap — only warns

**File:** `packages/api/src/routes/schedules.ts:99-113`

Overlap detection finds conflicts but still creates the entry, returning a warning. This is a design choice but risky — the warning can be silently ignored by API consumers. Frontend shows a toast but entry is already created.

**Action:** Consider making overlap a blocking error, or at least add a `force: true` body param to explicitly acknowledge overlap.

### M4. `toJSON` transform on User model references `_doc` via `_doc.telegram_bot_token` implicitly

**File:** `packages/api/src/models/user.ts:31-35`

```ts
transform: (_doc, ret) => {
  delete ret.telegram_bot_token
  ret.has_telegram_bot = !!_doc.telegram_bot_token && !!_doc.telegram_chat_id
```

`_doc` is the Mongoose document. Since `telegram_bot_token` has `select: false`, `_doc.telegram_bot_token` will be `undefined` in most queries (unless `.select('+telegram_bot_token')` is used). So `has_telegram_bot` will always be `false` in normal serialization (e.g., auth responses, admin user lists).

**Fix:** Use `ret.telegram_bot_token` before deleting it, or check the raw DB document:
```ts
transform: (_doc, ret) => {
  const hadToken = !!ret.telegram_bot_token
  delete ret.telegram_bot_token
  ret.has_telegram_bot = hadToken && !!ret.telegram_chat_id
```

### M5. `cleanupExpiredSessions` loads ALL sessions with full populate

**File:** `packages/api/src/services/alert-service.ts:202`

```ts
const sessions = await ActiveSession.find({}).populate('schedule_id')
```

Loads all sessions every 5 minutes. Should filter to only potentially expired ones.

---

## LOW Priority

### L1. Frontend `schedule.tsx:61` — setState during render

```ts
if (!activeSeatId && seats.length > 0) {
  setActiveSeatId(seats[0]._id);
}
```

Calling `setState` during render triggers a re-render. Use `useMemo` or `useEffect` instead.

### L2. `User` shared type still has `seat_id?: string | null` (singular)

**File:** `packages/shared/types.ts:32`

But the backend model uses `seat_ids` (plural array). Type mismatch may cause frontend issues.

### L3. Dashboard `/enhanced` endpoint does 8+ DB queries in sequence

Works fine at current scale but will slow down as data grows. Consider caching with a short TTL (30s).

---

## Positive Observations

- AES-256-GCM with random IV + auth tag is the correct approach for encrypting tokens at rest
- `select: false` on `telegram_bot_token` prevents accidental leakage in normal queries
- `toJSON` transform strips the encrypted token from serialized output (belt + suspenders)
- `insertIfNew` uses atomic `findOneAndUpdate` with `$setOnInsert` — correctly prevents duplicate alerts
- Schedule model validates `start_hour < end_hour` at both route and schema level
- Migration from slot-based to hourly is non-destructive with reasonable defaults

---

## Unresolved Questions

1. Is schedule overlap intentionally allowed (soft warning) or should it block? Current behavior could lead to double-booking confusion.
2. Should non-admin users be able to create/edit/delete schedule entries, or is this admin-only? Current code allows any authenticated user.
3. `sendToUser()` appears to be prepared for personal bot notifications but is never called — is this intentional (Phase 3 incomplete) or by design?
