# Documentation Update Report
**Date:** 2026-04-04  
**Agent:** docs-manager  
**Task:** Update all project documentation to reflect current codebase state

---

## Summary

Updated 6 documentation files to reflect recent code changes. All docs now accurately document:
- Seat ownership model with `owner_id` field
- Per-user alert settings (removed global config)
- Cron job timing: 30 min → 5 min for usage collection
- Hourly notification schedule (no more morning/afternoon slots)
- Removed scripts: `seed-data.ts` and `db-reset.ts`
- AlertMetadata field rename: `window` → `session`
- Clear admin vs user permission model (admin has ALL user perms EXCEPT credential export of others' seats)

---

## Files Updated

### 1. docs/codebase-summary.md (386 → 390 lines)
**Changes:**
- Removed references to deleted `seed-data.ts` and `scripts/db-reset.ts`
- Updated Seat model to include `owner_id`, `oauth_credential`, `token_active`, `last_fetched_at`, `last_refresh_at`
- Updated User model: added `telegram_topic_id`, `watched_seat_ids`; removed `report_scope` and `subscribed_seat_ids`; split notification + alert settings
- Updated Alert model: added alert types ('session_waste', '7d_risk'); renamed metadata field `window` → `session`
- Updated Seats API endpoints: added ownership-based routes, removed bulk export
- Added test-bot endpoint to User Settings
- Updated Admin endpoints: added bulk-active and check-alerts
- Updated Cron Jobs: 30 min → 5 min for usage collection

### 2. docs/system-architecture.md (620 → 700 lines)
**Changes:**
- Updated User model: added `telegram_topic_id`, `watched_seat_ids`, split settings
- Updated Alert model: added new alert types, renamed `window` → `session`
- Added comprehensive Permission Model section:
  - Middleware hierarchy table
  - Clear statement: "Admin has ALL user perms EXCEPT credential export of others' seats"
  - Detailed permission table by route (ownership bypass rules)
- Updated Route Structure: clarified ownership checks, removed bulk export
- Updated Cron Jobs: emphasize per-user alert subscriptions and budget tracking
- Updated Development Process: removed `pnpm run db:reset` step, clarified `.env.local` usage
- Updated API port references: 3001 → 8386

### 3. docs/project-overview-pdr.md (179 → 195 lines)
**Changes:**
- Updated Scheduling feature: changed from morning/afternoon slots to hourly with budget allocation
- Added new feature #7: "Seat Ownership & Per-User Settings" with owner model, alert subscriptions, personal Telegram bot
- Updated Technical Requirements: cron timing 30 min → 5 min
- Updated Current State (Done): added all per-user features, seat ownership, active sessions, budget alerts
- Updated Feature descriptions to emphasize per-user customization

### 4. docs/code-standards.md (440 → 435 lines)
**Changes:**
- Removed "Seed Data & Initialization" section (no longer applicable)
- Replaced with "Database Initialization": Mongoose auto-creates collections, no auto-seed
- Updated Database section: removed `pnpm run db:reset` reference, added manual mongosh instructions

### 5. README.md (263 → 255 lines)
**Changes:**
- Removed `pnpm db:reset` from Quick Start setup
- Removed from Commands table
- Updated Collections description: added owner_id, alert_settings, active_sessions
- Updated directory structure: removed seed-data.ts, db-reset.ts
- Reorganized Key Features section to emphasize seat ownership, per-user settings, hourly scheduling
- Removed "Reset Database" from Common Tasks

### 6. README.en.md (263 → 255 lines)
**Changes:**
- Same updates as README.md (English version)
- Removed db:reset references
- Updated Collections and Features descriptions
- Updated project structure, Scheduling, and Alerts sections to match current implementation

---

## Key Documentation Improvements

### 1. Permission Model Clarity
Added explicit documentation that:
- Admin role has ALL user permissions PLUS management of all seats
- EXCEPTION: Admin CANNOT export credentials of seats owned by other users
- `requireSeatOwner()` middleware strictly prevents admin bypass for credential export

### 2. Codebase Accuracy
- Removed all references to deleted scripts (seed-data.ts, db-reset.ts, db:reset command)
- Updated all directory structure diagrams
- Fixed cron job timing: 30 minutes → 5 minutes
- Corrected API port references: 8386 (not 3001)

### 3. Feature Documentation
- Hourly scheduling model clearly documented (not morning/afternoon slots)
- Per-user alert subscriptions and thresholds documented
- Active session tracking for budget alerts explained
- Personal Telegram bot integration (encrypted) documented

### 4. Data Model Accuracy
- Seat model: added ownership, token management, OAuth credential fields
- User model: split notification + alert settings, added seat subscriptions
- Alert model: new alert types, renamed metadata fields
- All field names match exact case from code (snake_case for DB fields)

---

## Validation Checklist

- [x] All deleted files removed from documentation (seed-data.ts, db-reset.ts)
- [x] All command references updated (pnpm db:reset removed)
- [x] Cron job timing corrected (30 min → 5 min)
- [x] Seat ownership model documented with permission hierarchy
- [x] Per-user settings clearly explained (alert thresholds, watched seats, notification schedule)
- [x] Admin permission model documented (all user perms EXCEPT credential export)
- [x] Hourly scheduling documented (not morning/afternoon)
- [x] Alert metadata field renamed (window → session)
- [x] API endpoints updated (ownership-based, removed bulk export)
- [x] Directory structure updated
- [x] All docs under 800 LOC limit

---

## Files Modified (Absolute Paths)

1. **D:\CONG VIEC\quan-ly-team-claude\docs\codebase-summary.md** — 390 LOC
2. **D:\CONG VIEC\quan-ly-team-claude\docs\system-architecture.md** — 700 LOC
3. **D:\CONG VIEC\quan-ly-team-claude\docs\project-overview-pdr.md** — 195 LOC
4. **D:\CONG VIEC\quan-ly-team-claude\docs\code-standards.md** — 435 LOC
5. **D:\CONG VIEC\quan-ly-team-claude\README.md** — 255 LOC
6. **D:\CONG VIEC\quan-ly-team-claude\README.en.md** — 255 LOC

---

## Status

**DONE** — All 6 documentation files updated and validated. Documentation now accurately reflects current codebase state with emphasis on:
- Seat ownership model
- Per-user alert settings and subscriptions
- Admin permission limitations (no credential export bypass)
- Correct cron timing and scheduling model
- Removed scripts properly purged from all references

