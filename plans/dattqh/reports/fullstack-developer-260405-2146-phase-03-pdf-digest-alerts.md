# Phase 3 Implementation Report — PDF Digest + Alert Settings

## Phase
- Phase: phase-03-pdf-digest-alerts
- Plan: plans/dattqh/260405-2109-enterprise-bld-dashboard/
- Status: completed

## Files Modified

| File | Change |
|------|--------|
| `packages/api/src/config.ts` | Added `dataDir`, `digestLinkSecret`, `bldDigestTelegramTopicId`, `telegram.*` fields |
| `packages/api/src/models/user.ts` | Extended `IAlertSettings` + schema with `bld_digest_enabled`, `fleet_util_threshold_pct`, `fleet_util_threshold_days` |
| `packages/api/src/services/telegram-service.ts` | Added `sendBldDigest(link)` using system bot |
| `packages/api/src/index.ts` | Mounted `bldDigestRoutes`, added Friday 17:00 cron + daily purge cron |
| `packages/shared/types.ts` | Extended `UserAlertSettings` with BLD fields |
| `packages/web/src/pages/settings.tsx` | Added `BldAlertSettingsForm` in admin-only section |
| `vitest.config.ts` | Added `tests/api/bld-pdf-service.test.ts` to include list |

## Files Created

| File | Purpose |
|------|---------|
| `packages/api/src/services/bld-digest-signer.ts` | HMAC-SHA256 sign/verify for download links (split for <200 LOC) |
| `packages/api/src/services/bld-pdf-data-helper.ts` | DB query helper (latestSnapshotsForSeats) extracted to avoid circular deps |
| `packages/api/src/services/bld-pdf-service.ts` | PDF generation via pdfkit A4 + `purgeExpiredDigests()` |
| `packages/api/src/routes/bld-digest.ts` | GET /current.pdf (admin) + GET /download/:token (public signed) |
| `packages/web/src/components/bld-alert-settings-form.tsx` | Toggle digest + fleet util threshold inputs |
| `tests/api/bld-pdf-service.test.ts` | 8 tests: signer roundtrip, tampering, expiry, purge, PDF generation |

## Tasks Completed

- [x] Install pdfkit + @types/pdfkit
- [x] Add DATA_DIR, DIGEST_LINK_SECRET, BLD_DIGEST_TELEGRAM_TOPIC_ID to config
- [x] Create bld-digest-signer.ts (sign + verify)
- [x] Create bld-pdf-data-helper.ts (snapshot query)
- [x] Create bld-pdf-service.ts (generate + purge)
- [x] Create bld-digest routes (current.pdf, download/:token)
- [x] Extend Friday 17:00 cron + daily 03:00 purge cron
- [x] Telegram service: sendBldDigest
- [x] Extend user.alert_settings schema
- [x] Extend shared types (UserAlertSettings)
- [x] Create bld-alert-settings-form component
- [x] Mount form in settings page (admin-only)
- [x] Tests: bld-pdf-service (8 tests)
- [x] API build clean
- [x] Web build clean
- [x] All 85 tests pass

## Tests Status

- Type check (API): PASS (tsx build, no errors)
- Type check (Web): PASS (tsc -b clean)
- Unit tests: PASS — 85/85 (10 test files)
  - New: 8 tests in bld-pdf-service.test.ts all passing

## Design Decisions

1. **Split into 3 service files** to stay under 200-LOC rule: `bld-digest-signer.ts` (signing), `bld-pdf-data-helper.ts` (DB query), `bld-pdf-service.ts` (PDF + purge)
2. **`getDigestDir()` reads `process.env.DATA_DIR` at call time** (not module load) — required for test env isolation
3. **Vietnamese accented chars avoided in PDF** — pdfkit default Helvetica font doesn't embed Vietnamese glyphs; used ASCII-safe transliterations to prevent garbled characters
4. **Token format**: `base64url({filePath}:{expiresAtMs}:{hmac-hex})` — filePath may contain colons on Windows, so split from right to extract sig, then expiresAt, then path
5. **System Telegram bot** config added under `config.telegram.*` — reuses existing env vars `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`

## Unresolved Questions

- Vietnamese font rendering: pdfkit bundles only Helvetica/Times/Courier (no Unicode). For production, embed a Vietnamese TTF (e.g. Roboto). This is a cosmetic issue only — PDF is otherwise valid.
- `buildDownloadUrl` constructs URL using `config.webUrl` (frontend URL). If API is behind a different hostname than the web app, this needs a dedicated `API_URL` config var. Currently safe for single-host deployments.
