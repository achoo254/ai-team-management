# Code Review: OAuth Token Refresh & Credential Management

**Date:** 2026-04-04
**Reviewer:** code-reviewer
**Scope:** 11 source files, ~430 LOC changed (excluding plan deletions)
**Focus:** Security (token handling, encryption), correctness, edge cases

## Overall Assessment

Implementation is well-structured: AES-256-GCM encryption, `select:false` on credentials, mutex guards on cron jobs, parallelLimit concurrency control. However, there are several security and correctness issues that need attention before production.

---

## Critical Issues

### C1. Encrypted tokens leaked in PUT /token response

**File:** `packages/api/src/routes/seats.ts:269-279`

`findByIdAndUpdate` without `.select('+oauth_credential')` returns the document. Since `select:false` is on the schema, the returned doc should exclude `oauth_credential` by default. However, the `{ new: true }` option with `findByIdAndUpdate` includes fields that were just written in the update payload — meaning the **encrypted** `access_token` and `refresh_token` ciphertexts are returned in the response.

While not plaintext, leaking ciphertext to the client is unnecessary exposure. If the response goes through toJSON (which it does for Mongoose documents), it strips `access_token`/`refresh_token`. But verify this path works correctly — `.lean()` is NOT used here, so toJSON should fire. This is likely safe but should be explicitly tested.

**Impact:** Low-Medium. Encrypted values (not plaintext) but unnecessary exposure.
**Fix:** Either return only a success message without the seat object, or explicitly select fields:
```ts
res.json({ message: 'Credential updated' })
```

### C2. No validation on OAuth refresh response shape

**File:** `packages/api/src/services/token-refresh-service.ts:37-47`

After a successful HTTP 200, the code blindly trusts `data.access_token`, `data.refresh_token`, `data.expires_in`. If the API returns 200 but with an unexpected shape (empty body, changed field names), `encrypt(undefined)` would be called, corrupting the stored credential.

**Impact:** High. Corrupted credential = seat becomes unusable + silent failure.
**Fix:**
```ts
if (!data.access_token || typeof data.expires_in !== 'number') {
  throw new Error('Invalid refresh response: missing access_token or expires_in')
}
```

### C3. `parseCredential` throws unhandled on malformed JSON

**File:** `packages/api/src/routes/seats.ts:14`

`JSON.parse(body.credential_json)` throws `SyntaxError` on invalid JSON. The catch block at line 281 handles `SyntaxError`, which is good. However, if `credential_json` is a non-string truthy value (e.g., object from a crafted request body), `JSON.parse` on a non-string could throw a `TypeError`, not `SyntaxError`, bypassing the specific catch and returning a generic 500.

**Impact:** Low. Admin-only endpoint, but unhandled error type.
**Fix:** Add type check at top of `parseCredential` or catch all errors uniformly.

---

## High Priority

### H1. No index on token refresh query fields

**File:** `packages/api/src/models/seat.ts`

The token refresh cron queries:
```js
{ token_active: true, 'oauth_credential.refresh_token': { $ne: null }, 'oauth_credential.expires_at': { $lt: threshold } }
```

No compound index exists for these fields. With small dataset this is fine, but if seat count grows, this becomes a collection scan every 5 minutes.

**Fix:** Add compound index:
```ts
seatSchema.index({ token_active: 1, 'oauth_credential.expires_at': 1 })
```

### H2. Race condition between token refresh and usage collection

**Files:** `token-refresh-service.ts`, `usage-collector-service.ts`

Both crons run independently (5min and 30min). If token refresh runs mid-usage-collection:
1. Collector reads `access_token` from DB
2. Refresh service updates `access_token` to new value
3. Collector uses OLD token which may now be revoked

The mutex guards only prevent self-overlap, not cross-service conflicts.

**Impact:** Medium. Transient failures on affected seats — retry on next cycle would succeed.
**Mitigation:** Acceptable for current scale. Document the known race. For robustness, usage collector could retry once on 401.

### H3. `parallelLimit` swallows rejected promises silently

**File:** `packages/api/src/utils/parallel-limit.ts:9`

```ts
const p = fn(item).then(() => { executing.splice(executing.indexOf(p), 1) })
```

If `fn(item)` rejects, the `.then()` never fires, so `p` stays in `executing` array. The final `Promise.all(executing)` will reject with the first error. However, callers wrap individual items in try/catch within the callback, so this doesn't manifest in practice. Still, the utility function itself has a subtle bug: on rejection, the array isn't cleaned up properly.

**Fix:**
```ts
const p = fn(item)
  .then(() => { executing.splice(executing.indexOf(p), 1) })
  .catch(() => { executing.splice(executing.indexOf(p), 1) })
```

### H4. Hardcoded OAuth client_id

**File:** `packages/api/src/services/token-refresh-service.ts:7`

```ts
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
```

Hardcoded client ID. Should be in config/env vars. If this rotates or differs between environments (staging/prod), a code change + deploy is required.

**Impact:** Medium. Operational risk.
**Fix:** Move to `config.ts` as `ANTHROPIC_OAUTH_CLIENT_ID`.

---

## Medium Priority

### M1. GET /seats leaks oauth_credential metadata to all authenticated users

**File:** `packages/api/src/routes/seats.ts:38-41`

The GET route uses `select('+oauth_credential')` with `.lean()` and manually strips tokens. But `.lean()` bypasses Mongoose's `toJSON` transform. The manual delete on lines 61-62 handles this correctly for the enriched response. However, this means **all authenticated users** (not just admins) can see `scopes`, `subscription_type`, `rate_limit_tier`, `expires_at`.

**Impact:** Low. Metadata only, no secrets. But violates least privilege.
**Recommendation:** Consider restricting metadata visibility to admins, or accept as intentional.

### M2. Token preview shows first 20 chars of access token in browser

**File:** `packages/web/src/components/seat-token-dialog.tsx:59-61`

```ts
function maskToken(token: string): string {
  return token.length > 20 ? token.slice(0, 20) + '...' : token
}
```

20 characters is a generous preview. Tokens can be reconstructed from prefixes. Should show 8 chars max, or better: show only last 4.

**Fix:**
```ts
function maskToken(token: string): string {
  return token.length > 8 ? '...' + token.slice(-4) : '****'
}
```

### M3. Raw credential JSON stored in React state

**File:** `packages/web/src/components/seat-token-dialog.tsx:64`

The full raw JSON (containing plaintext tokens) lives in React state (`rawJson`). It's cleared on save/close, which is good. However, React DevTools can inspect this state. This is acceptable for an admin-only internal tool but worth noting.

### M4. No `client_secret` in refresh request

**File:** `packages/api/src/services/token-refresh-service.ts:21-28`

The OAuth token refresh request sends `client_id` but no `client_secret`. This assumes the Anthropic OAuth flow uses public clients (PKCE). Verify this is correct per Anthropic's OAuth spec. If a secret is required, refresh will silently fail with 401.

---

## Low Priority

### L1. `expires_at` type mismatch between formats

- Shared type `OAuthCredentialMeta.expires_at` is `string | null`
- `parseCredential` accepts it as `number` (Unix timestamp from cookie export) or could be ISO string
- `new Date(cred.expires_at)` works for both but semantics differ

### L2. Unused `seat_ids` on User interface

Shared `types.ts` `User` interface has `seat_id?: string | null` (singular) but code uses `seat_ids` (plural array). Type mismatch — frontend may have stale type.

### L3. Schedule page `any` type addition

`packages/web/src/pages/schedule.tsx` — Added `any` type to DnD event. Acceptable workaround but should be typed properly when possible.

---

## Positive Observations

- **AES-256-GCM encryption** with proper IV/tag management — solid crypto implementation
- **`select: false`** on oauth_credential subdocument — defense in depth
- **toJSON transform** stripping tokens — prevents accidental serialization leaks
- **Mutex guards** on both cron jobs — prevents overlapping runs
- **Telegram alerts** on refresh failure + auto-deactivation of failed tokens
- **Structured error handling** with truncated error messages (no stack trace leaks)
- **AbortSignal.timeout** on fetch calls — prevents hanging requests
- **Tab-based UI** (paste/upload) with parse preview — good UX for credential input

---

## Recommended Actions (Priority Order)

1. **[Critical]** Validate refresh response shape before `encrypt()` (C2)
2. **[High]** Move `CLIENT_ID` to env config (H4)
3. **[High]** Fix `parallelLimit` cleanup on rejection (H3)
4. **[Medium]** Reduce token preview to last 4 chars (M2)
5. **[Medium]** Verify Anthropic OAuth doesn't require client_secret (M4)
6. **[Low]** Add compound index on seat for token refresh query (H1)
7. **[Low]** Fix `User` type `seat_id` vs `seat_ids` mismatch (L2)

---

## Unresolved Questions

1. Does Anthropic's OAuth token endpoint return a new `refresh_token` on every refresh? If not, line 42 in `token-refresh-service.ts` would encrypt `undefined` and overwrite the valid stored refresh token.
2. Is `CLIENT_ID` intentionally public (PKCE flow) or should there be a `client_secret`?
3. Is the 5-minute cron interval + 5-minute expiry buffer sufficient? If a token expires in 4 minutes and the cron just ran, it won't be refreshed until the next cycle (in 5 min) — by which time it's expired.
