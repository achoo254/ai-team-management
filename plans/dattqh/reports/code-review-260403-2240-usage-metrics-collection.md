# Code Review: Usage Metrics Collection

**Reviewer:** code-reviewer | **Date:** 2026-04-03 | **Scope:** 16 files (new feature)

## Overall Assessment

Solid feature implementation. Clean separation of concerns, proper auth gates, good use of encryption for tokens. A few **critical** and **high** severity issues found, mostly around data leaks and race conditions.

---

## Critical Issues (Blocking)

### C1. `access_token` leaked via `.lean()` in existing Seat queries

**File:** `packages/api/src/routes/dashboard.ts` (L87, L162), `packages/api/src/services/telegram-service.ts` (L63, L153)

`Seat.find().lean()` bypasses `toJSON` transform, so `access_token` (encrypted) is present in the plain object. While current dashboard routes manually pick fields before `res.json()`, this is **fragile by design** -- any future route that does `res.json(seats)` after `.lean()` will leak encrypted tokens.

The GET `/api/seats` route correctly uses `{ access_token: 0 }` projection. Other Seat queries do not.

**Impact:** Encrypted token material leaking to client if any downstream code changes. Telegram service holds decryptable tokens in memory unnecessarily.

**Fix:** Add `{ access_token: 0 }` projection to ALL `Seat.find()` calls that don't need the token. Or create a reusable `SEAT_SAFE_PROJECTION` constant:

```ts
export const SEAT_SAFE_PROJECTION = { access_token: 0 }
// Usage: Seat.find({}, SEAT_SAFE_PROJECTION).lean()
```

### C2. `collectSeatUsage` skips `token_active` check

**File:** `packages/api/src/services/usage-collector-service.ts` L136-141

`collectSeatUsage()` only checks `seat.access_token` exists but does NOT check `token_active`. An admin who deactivated a token (set `token_active: false` but kept the encrypted blob) can still have usage collected via the single-seat endpoint.

```ts
// Current
if (!seat.access_token) throw new Error('Seat has no access token')

// Should be
if (!seat.access_token || !seat.token_active) throw new Error('Seat has no active token')
```

### C3. `ENCRYPTION_KEY` empty string accepted at startup

**File:** `packages/api/src/config.ts` L16

`encryptionKey` defaults to `''`. The crypto service only throws when `getKey()` is called (at encrypt/decrypt time), not at startup. If a seat token is stored without `ENCRYPTION_KEY` configured, the app crashes mid-request.

**Fix:** Validate at startup in `index.ts`:
```ts
if (!config.encryptionKey) console.warn('[Config] ENCRYPTION_KEY not set -- token features disabled')
```
Or better: fail fast if tokens exist in DB but key is missing.

---

## High Priority

### H1. Race condition in `parallelLimit` counters

**File:** `packages/api/src/services/usage-collector-service.ts` L111-126

`success++` and `errors++` are mutated from concurrent async callbacks. While Node.js is single-threaded, the `await` inside `parallelLimit` yields control. Since `++` is not atomic across await boundaries with concurrent promises, the counters could lose increments if two promises resolve in the same microtask tick.

**Risk:** Low in practice (Node event loop), but the `as any` cast on L117 and L140 is a code smell. Consider using `Promise.allSettled` pattern instead for cleaner counting.

### H2. `decipher.update(encrypted) + decipher.final('utf8')` encoding mismatch

**File:** `packages/api/src/services/crypto-service.ts` L34

```ts
return decipher.update(encrypted) + decipher.final('utf8')
```

`decipher.update(encrypted)` without encoding returns a Buffer. `Buffer + string` coerces Buffer to string using default encoding (UTF-8 in Node), which works but is **implicit and fragile**. Should be:

```ts
return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
```

### H3. `Authorization` header sends raw token without `Bearer` prefix

**File:** `packages/api/src/services/usage-collector-service.ts` L26

```ts
headers: { 'Authorization': token, ... }
```

Most OAuth APIs expect `Bearer <token>`. If the Anthropic OAuth usage API follows standard conventions, this will fail with 401. Verify the expected format. If it needs `Bearer`:

```ts
'Authorization': `Bearer ${token}`
```

### H4. No request timeout on Anthropic API fetch

**File:** `packages/api/src/services/usage-collector-service.ts` L22-29

`fetch()` has no timeout. If Anthropic is slow, the collector blocks indefinitely. With 30-min cron, overlapping runs are prevented by the mutex, but a hung fetch means NO data collection until process restart.

**Fix:**
```ts
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 15_000)
const res = await fetch(API_URL, { signal: controller.signal, ... })
clearTimeout(timeout)
```

### H5. `last_fetch_error` stores raw HTTP response body

**File:** `packages/api/src/services/usage-collector-service.ts` L32

```ts
throw new Error(`HTTP ${res.status}: ${body}`)
```

`body` is the full response text from Anthropic -- could contain internal error details, stack traces, or sensitive info. This gets stored in `last_fetch_error` field and exposed to the frontend via seat API response.

**Fix:** Truncate: `body.slice(0, 200)`

---

## Medium Priority

### M1. Duplicate `Seat` type definition in frontend

**File:** `packages/web/src/hooks/use-seats.ts` L8-13 vs `packages/shared/types.ts` L3-14

`use-seats.ts` defines its own `Seat` interface instead of using `@repo/shared`. The `usage-metrics.tsx` page imports both and uses `as unknown as SharedSeat` cast (L37). This is a type safety gap.

**Fix:** Remove local `Seat` from `use-seats.ts`, import from `@repo/shared`.

### M2. Token dialog state not reset when switching seats

**File:** `packages/web/src/components/seat-token-dialog.tsx` L19

`useState('')` persists across dialog opens. If admin types a token, closes without saving, then opens another seat's dialog, the stale input is still there.

**Fix:** Reset on open:
```tsx
useEffect(() => { setToken('') }, [seat?._id])
```

### M3. No rate limiting on token endpoints

**File:** `packages/api/src/routes/seats.ts` L210-266

PUT/DELETE token endpoints have no rate limiting. Brute-force token enumeration possible if admin account is compromised.

### M4. `from`/`to` query params not validated

**File:** `packages/api/src/routes/usage-snapshots.ts` L48-49

```ts
if (from) dateFilter.$gte = new Date(from as string)
```

`new Date('invalid')` produces `Invalid Date`, which Mongoose passes to MongoDB as-is. This won't crash but returns unexpected results.

### M5. Usage metrics page not gated to admin

**File:** `packages/web/src/app.tsx` L34, `packages/web/src/components/app-sidebar.tsx` L31

Route `/usage-metrics` visible to all authenticated users. The collect endpoints are admin-gated server-side (good), but the page itself shows all seat usage data. Verify this is intentional -- if non-admin users shouldn't see other seats' usage, add `adminOnly: true` to the nav item and a frontend guard.

---

## Low Priority

### L1. `as any` casts in collector service

L117 `seat as any` -- should type the lean result properly:
```ts
type LeanSeat = { _id: mongoose.Types.ObjectId; access_token: string; label: string; ... }
```

### L2. Hardcoded API URL

`usage-collector-service.ts` L6: `const API_URL = 'https://api.anthropic.com/api/oauth/usage'` should use `config.anthropic.baseUrl` for consistency.

### L3. Missing `updatedAt` on UsageSnapshot

No `updatedAt` field -- fine since snapshots are immutable, but worth a comment.

---

## Positive Observations

- AES-256-GCM with random IV per encryption -- correct crypto pattern
- `toJSON` transform on Seat model to strip `access_token` -- defense in depth
- TTL index on snapshots (90 days) -- good data hygiene
- Compound index `{ seat_id: 1, fetched_at: -1 }` -- correct for the query patterns
- Mutex guard on collector prevents overlapping cron runs
- Concurrency limiter for parallel API calls
- Projection `{ access_token: 0 }` on GET /api/seats
- Proper auth + admin gates on write endpoints
- Clean separation: crypto-service, usage-collector-service, routes

---

## Recommended Actions (Priority Order)

1. **C1** -- Add `access_token: 0` projection to all Seat queries that don't need token
2. **C2** -- Check `token_active` in `collectSeatUsage`
3. **H3** -- Verify `Authorization` header format for Anthropic OAuth API
4. **H4** -- Add fetch timeout (15s)
5. **H5** -- Truncate error body before storing
6. **C3** -- Startup warning/validation for `ENCRYPTION_KEY`
7. **M1** -- Remove duplicate Seat type, use shared
8. **M2** -- Reset token dialog state on seat change

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Feature well-structured with good security fundamentals. 3 critical issues (token leak via lean, missing token_active check, missing startup validation) and 5 high-priority issues need fixing before merge.
**Concerns:** C1 (access_token in lean queries) is a latent data leak that gets worse as codebase grows. H3 (Authorization header format) may cause the entire feature to silently fail in production.
