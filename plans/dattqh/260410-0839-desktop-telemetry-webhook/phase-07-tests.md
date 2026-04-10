# Phase 7: Tests

## Overview
- Priority: HIGH
- Status: completed
- Depends on: Phase 6

## Test Files to Create

Tests use existing in-memory Mongo helper at `tests/helpers/db-helper.ts`.

### 7.1 `tests/api/devices.test.ts`

Cases:
- POST /api/devices with valid JWT → 201, response contains `api_key` (plaintext) and `device.api_key_prefix` matches first 12 chars
- POST without JWT → 401
- POST with empty device_name → 400
- GET /api/devices returns only current user's devices (not other users')
- GET response does NOT contain `api_key_encrypted` field
- DELETE /api/devices/:id sets revoked_at, device still exists in DB
- DELETE on already-revoked device → 404
- DELETE on other user's device → 404 (scoped query)

### 7.2 `tests/api/webhook.test.ts`

Helper function:
```ts
function signRequest(apiKey: string, body: string, timestamp: number) {
  return createHmac('sha256', apiKey).update(`${timestamp}.${body}`).digest('hex')
}
```

Cases:
- Valid HMAC + timestamp + payload → 200, returns `accepted_sessions: N`
- Missing X-Device-Id → 401
- Missing X-Signature → 401
- Wrong signature (random hex) → 401
- Timestamp older than 5min → 401
- Timestamp in future > 5min → 401
- Revoked device → 401
- member_email không match user.email → 401
- Invalid JSON body → 400
- Schema validation fail (missing `event` field) → 400
- Payload size > 512kb → 413 (or rate limit)
- **Idempotency**: send same payload twice → only 1 ClaudeSession record per session_id, fields updated to latest
- After ingest: device.last_seen_at, last_ram_used_mb, system_info, app_version updated
- Sessions linked to seat when profile.email matches existing seat
- Sessions have seat_id=null when profile.email doesn't match any seat
- profile_email field stored regardless

### 7.3 `tests/services/webhook-verify-service.test.ts`

Unit test the verify service in isolation:
- Returns ok with valid params
- Returns ok=false on each failure mode (missing headers, invalid timestamp, out of window, unknown device, revoked, sig mismatch, sig wrong format)
- Uses `timingSafeEqual` semantics (test with sig of wrong length)

### 7.4 `tests/services/webhook-ingest-service.test.ts`

Unit test ingest with mocked device:
- Updates device fields from payload
- Maps profile.email → seat_id correctly
- Multi-session payload creates N records
- Re-ingest same session_id → upsert (1 record, latest fields)
- Empty profiles array → 0 sessions, device still updated

## Test Helpers Needed
- Reuse `tests/helpers/db-helper.ts` for in-memory mongo
- Create local helper in webhook test for HMAC signing
- Use existing user/seat factories if present, or create inline

## Acceptance
- `pnpm test` passes
- New tests cover all critical paths
- No mocks of mongoose/encryption (real implementations against in-memory db)
- Coverage on new code ≥ 80%

## Todo
- [x] tests/api/device-service.test.ts (unit — create/generate api key)
- [x] tests/api/webhook-schema.test.ts (zod schema)
- [x] tests/api/webhook-verify-service.test.ts (HMAC verify unit)
- [x] tests/api/webhook-ingest-service.test.ts (ingest unit — seat mapping, idempotent upsert, device snapshot)
- [x] tests/api/devices-route.test.ts (route integration — JWT + CRUD via mini express app + fetch)
- [x] tests/api/webhook-route.test.ts (route integration — raw body, verify→zod→member_email→ingest pipeline)
- [x] All tests pass (44 tests across 6 files)
