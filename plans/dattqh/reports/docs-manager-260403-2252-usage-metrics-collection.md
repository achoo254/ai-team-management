# Documentation Update Report: Usage Metrics Collection Feature

**Date:** 2026-04-03  
**Status:** COMPLETED

## Summary

Updated 3 core documentation files to reflect the new Usage Metrics Collection feature implementation. All changes verified against actual codebase implementation.

## Changes Made

### 1. `docs/codebase-summary.md` (385 LOC, +65 lines)

**Added/Updated:**
- New `usage-snapshot.ts` model in directory structure (with TTL details)
- Extended `seat.ts` description (access_token encrypted)
- New `usage-snapshots.ts` route file
- New `crypto-service.ts` and `usage-collector-service.ts` services
- New `usage-metrics.tsx` frontend page
- Token management endpoints in Seats section:
  - `PUT /api/seats/:id/token` — Set/update access token
  - `DELETE /api/seats/:id/token` — Remove access token
- New Usage Snapshots API endpoints section (query, collect, latest)
- New 30-min usage collection cron job (moved Friday jobs description to explicitly list all three)
- `ENCRYPTION_KEY` environment variable added to config table

### 2. `docs/system-architecture.md` (525 LOC, +50 lines)

**Added/Updated:**
- Database collections count: 6 → 7 (added usage_snapshots)
- Added TTL detail for 90-day auto-expiration
- Service layer: 4 → 6 files (added crypto-service, usage-collector-service)
- Route structure: 8 → 9 files (added usage-snapshots)
- Extended Seat model with: access_token, token_active, last_fetched_at, last_fetch_error, has_token (virtual)
- Complete UsageSnapshots model documentation
- Comprehensive 30-min usage collection cron job details:
  - Mutex guard preventing overlapping runs
  - Concurrent fetch (3 limit, 15s timeout)
  - Error tracking per seat
- New "Usage Collection Flow" data flow diagram (7 steps)
- ENCRYPTION_KEY added to required environment variables

### 3. `docs/project-overview-pdr.md` (184 LOC, +45 lines)

**Added/Updated:**
- New Feature #7: Usage Metrics Collection (sub-bullets: tokens, 30-min collection, tracking, querying, cleanup)
- Backend section: Added AES-256-GCM encryption mention
- Database section: Added usage_snapshots collection, TTL indexes
- Success Criteria: Added metrics collection, token encryption, snapshot queryability (expanded from 7 to 10 criteria)
- Acceptance Criteria: Added usage collection job, token crypto, snapshot storage, frontend display
- Current State: Added 4 new completed features (metrics collection, token management, snapshots, dashboard)
- Constraints: Added ENCRYPTION_KEY (32-byte requirement), Anthropic OAuth access token

## Verification Checklist

- [x] Read actual implementation files before documenting
- [x] Verified all new file paths exist in codebase
- [x] Confirmed function/service names match actual code
- [x] Checked API endpoint signatures against routes/usage-snapshots.ts
- [x] Verified model field names and types match schema definitions
- [x] Confirmed cron schedule (every 30 minutes via pattern `*/30 * * * *`)
- [x] Validated encryption algorithm (AES-256-GCM confirmed in crypto-service.ts)
- [x] All docs remain under 800 LOC per file
- [x] Cross-references checked (no broken links within docs/)
- [x] Terminology consistent across all 3 files

## Key Implementation Details Documented

| Feature | Detail | Location |
|---------|--------|----------|
| **Encryption** | AES-256-GCM (12-byte IV, 16-byte tag) | crypto-service.ts |
| **Token Storage** | Auto-excluded from queries via Mongoose pre-hook | seat.ts model |
| **Collection Frequency** | Every 30 minutes (mutex-guarded) | usage-collector-service.ts, cron setup |
| **Concurrency** | 3 parallel requests, 15s timeout per request | usage-collector-service.ts |
| **Data Retention** | 90-day TTL via Mongoose index | usage-snapshot.ts |
| **API Routes** | 4 endpoints: query (with pagination), latest, collect all, collect single | usage-snapshots.ts |
| **Token Endpoints** | PUT (set), DELETE (remove) on `/api/seats/:id/token` | seats.ts routes |
| **Frontend Page** | `/usage-metrics` with token dialog and snapshot grid | usage-metrics.tsx |

## Notes

- Documentation sacrificed some grammar for concision per team standards
- All environment variable additions are reflected across three files consistently
- Token encryption requirement highlighted in multiple sections for visibility
- Cron job section reorganized to clearly show all 3 scheduled tasks with descriptions
- No breaking changes to existing features documented; all updates additive

## Files Modified

- `D:/CONG VIEC/quan-ly-team-claude/docs/codebase-summary.md`
- `D:/CONG VIEC/quan-ly-team-claude/docs/system-architecture.md`
- `D:/CONG VIEC/quan-ly-team-claude/docs/project-overview-pdr.md`

**Total lines updated:** 160 lines across 3 files
**All files remain within 800 LOC limit:** ✓

---

**Status:** DONE  
**Concerns:** None — all code references verified against implementation.
