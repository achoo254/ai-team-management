# Code Review — BLD Dashboard (Phases 1–3)

**Scope:** BLD metrics service, PDF digest, signed-link routes, BLD page/components, data-quality panels on dashboard.
**Files:** 16 new + `dashboard.ts`, `index.ts`, `telegram-service.ts`, `config.ts` modifications.

---

## Scoring

| Area        | Score | Notes |
|-------------|:-----:|-------|
| Security    | 6/10  | HMAC correct but path-traversal vector + secret reuse |
| Correctness | 7/10  | React hooks-rule violation, cache never invalidated, N+1 in rebalance |
| Quality     | 6/10  | bld-metrics-service 371 LOC (over 200 limit), dead code, dup computation |

---

## Critical Issues

### C1. Path traversal in signed-download route (bld-digest.ts:52-77)
`verifyDigestLink` returns whatever `filePath` was baked into the HMAC-signed token. The download route calls `fs.existsSync(filePath)` + `fs.createReadStream(filePath)` with **no containment check** to `getDigestDir()`.

Risk:
- If `DIGEST_LINK_SECRET` is unset, it falls back to `JWT_SECRET` (config.ts:20). A leaked JWT secret now also forges download links for arbitrary absolute paths on disk (`/etc/passwd`, `.env`, seat-OAuth-credential JSON, etc.).
- The signer has no allowlist — a future bug or endpoint that signs a user-controlled path would be directly exploitable.

**Fix:**
```ts
// in verifyDigestLink — resolve and assert containment
const abs = path.resolve(filePath)
const digestDir = path.resolve(getDigestDir())
if (!abs.startsWith(digestDir + path.sep)) return { filePath, valid: false }
```
Also: sign only the **basename** (e.g. `2026-04-05.pdf`) and reconstruct `path.join(digestDir, basename)` at download time. Basename signing eliminates path traversal entirely.

### C2. React Hooks rule violation (pages/bld.tsx:31-42)
Early `return <Navigate>` at line 36 happens **before** `useQueryClient/useFleetKpis/useUserEfficiency/useRebalanceSuggestions` at lines 39-42. When `user.role` transitions (login/logout), React will throw "Rendered fewer hooks than expected" and unmount the tree.

**Fix:** Move all hook calls above the guard, OR wrap navigation in `useEffect`, OR extract an `<AdminOnly>` boundary component.

### C3. Secret reuse — DIGEST_LINK_SECRET falls back to JWT_SECRET (config.ts:20)
A single secret now guards both session auth AND download links. Blast-radius amplification — rotation becomes all-or-nothing. Either:
- Make `DIGEST_LINK_SECRET` mandatory when BLD digest is enabled, or
- Derive it via HKDF from `JWT_SECRET` + fixed salt (`hkdf(jwtSecret, 'bld-digest-link-v1')`) so it differs cryptographically.

---

## High Priority

### H1. N+1 queries in computeRebalanceSuggestions (bld-metrics-service.ts:263-370)
- Rule 1: for each (highSeat × lowSeat), runs `seatOverloadedForDays` + `seatUnderutilizedForDays` → each hits `UsageSnapshot.find`. O(M·N) DB calls.
- Rule 3: for each (user × assigned seat), runs `UsageSnapshot.find(..., fetched_at: { $gte: cutoff-14d })`. O(U·S) DB calls.
- `User.findOne({ seat_ids: highSeat._id, active: true })` inside the seat-pair loop — no ordering → **non-deterministic heavy-user selection**.

**Fix:** Pre-fetch 14 days of snapshots for all company seats once, group by `(seat_id, day)` in memory, then iterate rules against that map. Reduces Rule 3 from O(U·S) to 1 query + O(U·S) loop.

### H2. File size limit — bld-metrics-service.ts is 371 LOC
Project rule (`CLAUDE.md`, `.claude/rules/development-rules.md`) caps files at 200 LOC. Split:
- `bld-fleet-kpis.ts` (computeFleetKpis + computeWwHistory + seat filter helpers)
- `bld-user-efficiency.ts`
- `bld-rebalance-service.ts`

### H3. In-memory cache never invalidated (bld-metrics.ts:27-42)
5-min TTL means seat/user mutations are invisible for up to 5 minutes. Acceptable for fleet KPIs, but:
- **Test pollution**: cache is module-level — persists across test files in the same Vitest process. Add `clearCache()` export or `beforeEach` reset.
- **No LRU**: if cache keys ever become per-scope (e.g., per-team), unbounded growth.

### H4. Duplicate forecast computation on /dashboard/enhanced (routes/dashboard.ts)
`computeAllSeatForecasts(forecastSeatIdsEnhanced)` is called at line ~266 for `urgent_forecasts`, then effectively again downstream at ~586 for `sevenDayForecast`. Compute once, reuse the result.

---

## Medium Priority

### M1. Over-broad path-redaction regex (routes/dashboard.ts:sanitizeErrorMessage)
`/\/[^\s"']+|[A-Z]:\\[^\s"']+/g` matches `https://api.anthropic.com/...` and turns it into `https:[PATH]`. Not a security bug, but mangles useful debugging info. Anchor to path-like prefixes (`(?:^|\s)/`) or exclude `://`.

### M2. W/W history may return flat-line (bld-metrics-service.ts:155-178)
`historicalFleetUtil(seatIds, weekEnd)` uses `$first` over a `$lte: weekEnd` match. If no new snapshot is ingested between week N and N+1, both weeks return the same "latest up to weekEnd" value. Consider bounding with `$gte: weekStart, $lte: weekEnd` or document the behaviour in the PDF output.

### M3. Dead code in TokenFailurePanel (token-failure-panel.tsx:32-96)
`retryEndpointReady = false` is hard-coded. The `handleRetry` handler, fetch call, and `TODO(phase-2)` comment are all YAGNI violations. Either land the endpoint in this phase or delete the retry column until it ships.

### M4. `process.env` read inside module-level fn (bld-metrics-service.ts:27,44)
`parseMonthlyCost` and `parsePersonalDomains` re-read env on every call. Fine for tests, but a 100-seat fleet in `computeRebalanceSuggestions` triggers dozens of reads. Cache the parsed value module-scoped with test override hook.

### M5. `getCompanySeats` fetches ALL seats then filters in JS (bld-metrics-service.ts:66-69)
Works for small fleets (<1k seats). Preferable: `Seat.find({ email: { $not: { $regex: domainRegex } } })` — push filter to Mongo.

---

## Positive Observations

- **HMAC implementation** (bld-digest-signer.ts) uses `timingSafeEqual` + length check correctly.
- **JWT_SECRET validation on startup** (index.ts: `length < 32 → throw`) — good fail-fast.
- **`isCompanySeat` filter** is cleanly centralized and reused by all metric functions.
- **Sanitizer** covers bearer tokens, ya29 OAuth, long hex/base64 — thoughtful data-leak prevention.
- **Scope filtering** on `/dashboard/enhanced` correctly intersects `querySeatIds` with `allowed` for non-admins — `token_failures` cannot leak cross-tenant.
- **PDF generation** isolated in helper modules to respect 200-LOC limit.
- **Signed-link TTL** (7 days) is reasonable; expiry validation is correct.

---

## Top 3 Issues (Blocking)

1. **C1** — Path traversal in `/api/bld/digest/download/:token` (sign basename only, assert directory containment).
2. **C2** — React Hooks rule violation in `bld.tsx` (move guard below all hook calls).
3. **C3** — `DIGEST_LINK_SECRET` fallback to `JWT_SECRET` amplifies blast radius (require distinct secret or HKDF-derive).

---

## Unresolved Questions

1. Is admin-only enforcement expected on the `/dashboard` `token_failures` payload, or is per-owner scoping sufficient? (Currently only seat-scoped.)
2. Should the BLD digest link use basename-only signing + DB-stored digest registry instead of absolute paths? (Eliminates C1 cleanly.)
3. Apply-button actions in `BldActionsPanel` currently `console.log` — is that intentional for this phase, or should buttons be hidden until mutations land?
4. `last_fetch_error` field — where is it written? Verify upstream code never stores a raw access token string into it (sanitizer is defense-in-depth, not primary protection).

---

**Status:** DONE_WITH_CONCERNS
**Summary:** Feature is functionally complete but has 1 security-relevant path-traversal risk, 1 React correctness bug, and file-size/N+1/dead-code quality issues. Address C1-C3 before landing.
