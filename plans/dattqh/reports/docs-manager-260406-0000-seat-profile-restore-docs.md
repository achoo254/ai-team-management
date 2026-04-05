# Documentation Update Report: Seat Profile API + Restore Flow

**Date:** 2026-04-06  
**Agent:** docs-manager  
**Feature:** Seat Profile Cache & Restore Flow Implementation

## Summary

Updated project documentation (`./docs/`) to reflect the new Seat Profile API and Restore Flow feature. All documentation now accurately describes the implemented functionality without stale references.

## Documentation Files Updated

### 1. **docs/codebase-summary.md** (430 LOC)
**Changes:**
- Updated Seat model schema to include `profile` subdocument with: account_name, display_name, org_name, org_type, billing_type, rate_limit_tier, subscription_status, has_claude_max, has_claude_pro, fetched_at (marked as auto-populated, stale after 6h)
- Added `deleted_at` field (soft delete) and `include_in_overview` boolean to Seat model documentation
- Updated partial unique index note on `email` (unique only for non-deleted seats)
- Extended seats API endpoints section:
  - Added `GET /api/seats/:id/profile` — Get cached profile, auto-refresh if stale >6h
  - Added `POST /api/seats/:id/profile/refresh` — Force-refresh profile from Anthropic
  - Modified `POST /api/seats` to note support for `restore_seat_id` and `force_new`
  - Added `POST /api/seats/preview-token` — Preview credential validation + duplicates/restorable check
  - Modified `DELETE /api/seats/:id` to clarify soft-delete behavior
- Updated services directory structure:
  - Added `anthropic-service.ts` — OAuth profile fetch & cache
  - Added `seat-cascade-delete.ts` — Hard-delete + cleanup
- Updated component documentation:
  - Added `seat-form-dialog.tsx` — Create/restore seat flow
  - Added `seat-restore-banner.tsx` — Vietnamese restore choice UI

### 2. **docs/system-architecture.md** (714 LOC)
**Changes:**
- Updated Seats collection schema documentation:
  - Added `profile` subdocument with all fields (auto-populated, 6h stale threshold)
  - Noted `deleted_at` as indexed soft-delete field
  - Noted `include_in_overview` admin/owner toggle for dashboard visibility
  - Updated email unique constraint note (partial index for non-deleted seats)
- Updated Route Structure for `routes/seats.ts`:
  - Extended description: "Seat CRUD (owner auto-set), user assignment, token management, credentials export, profile cache"
  - Added `POST /seats` details: supports `restore_seat_id` (undelete) or `force_new` (admin-only, cascade-delete old)
  - Added `GET /seats/:id/profile` — Return cached profile, auto-refresh if stale >6h
  - Added `POST /seats/:id/profile/refresh` — Force-refresh profile from Anthropic OAuth endpoint
  - Added `POST /seats/preview-token` — Preview credential JSON: parse + fetch profile + check duplicates/restorable
  - Modified `DELETE /seats/:id` — Soft-delete seat (owner or admin); allow restore via restore_seat_id
  - Modified `PUT /seats/:id/token` — Set/update credential + auto-populate profile (owner or admin)
- Updated Seat Management Flow diagram:
  - Restructured to show full flow from preview → restore/create → profile auto-population
  - Added preview-token endpoint step (parse + OAuth profile fetch + check duplicates/restorable)
  - Added restore choice branch for soft-deleted seats with same email
  - Added force_new option (admin-only, cascade-delete old + create fresh)
  - Added atomic undelete via findOneAndUpdate (set deleted_at: null)
  - Added profile auto-population on token setup
  - Added refresh profile endpoint
  - Added get profile endpoint with stale fallback
- Updated Permission Model by Route — Seat Management section:
  - Added `POST /seats/preview-token` [authenticate]
  - Modified `POST /api/seats` to note `force_new` requires admin
  - Added `GET /api/seats/:id/profile` [authenticate, requireSeatOwnerOrAdmin]
  - Added `POST /api/seats/:id/profile/refresh` [authenticate, requireSeatOwnerOrAdmin]
  - Modified `DELETE /api/seats/:id` to clarify soft-delete
  - Modified `PUT /api/seats/:id/token` to note auto-refresh profile

### 3. **docs/project-overview-pdr.md** (201 LOC)
**Changes:**
- Updated Feature 1: Seat Management section:
  - Added "Soft-delete with restore capability (restore_seat_id)"
  - Added "Admin force-new mode: cascade-delete old seat + create fresh (force_new)"
  - Added "Auto-populate seat profile on token setup (account_name, org_name, rate_limit_tier, subscription status)"
  - Added "Get/refresh cached profile (6h staleness threshold)"
  - Added "Admin overview toggle (include_in_overview) for BLD metrics"
- Updated "Current State (Done)" section:
  - Added "Seat soft-delete with restore capability (restore_seat_id, force_new)"
  - Added "Seat profile cache (account_name, org_name, rate_limit_tier, subscription_status)"
  - Added "Profile auto-refresh on token updates + manual refresh endpoint (6h staleness)"
  - Added "Seat preview API (POST /preview-token) for credential validation + duplicate detection"
  - Added "Vietnamese UI for seat restore flow (choice banner)"

## New Shared Types Verified

The following types exist in `packages/shared/types.ts`:
- `SeatProfile` interface — matches profile subdocument structure
- `RestorableSeat` interface — returned by preview-token endpoint
- Extended `Seat` interface — includes profile field

## New Services Verified

- `packages/api/src/services/anthropic-service.ts` — Exports:
  - `fetchOAuthProfile(accessToken)` — Fetches OAuth profile from Anthropic
  - `OAuthProfileError` class — Error handling with status + body
  - `toProfileCache(profile)` — Maps OAuthProfile → flat profile cache object
- `packages/api/src/services/seat-cascade-delete.ts` — Exports:
  - `cascadeHardDelete(seatIds)` — Hard-deletes seats + all related data (usage, alerts, schedules, sessions, windows, metrics)

## New Components Verified

- `packages/web/src/components/seat-restore-banner.tsx` — Vietnamese restore choice UI
  - Shows soft-deleted seat info (label, deleted_at, has_history)
  - Two action buttons: "Khôi phục" (Restore) and "Tạo mới" (Create New)
  - Loading state handling

- `packages/web/src/components/seat-form-dialog.tsx` — Updated to support:
  - `restore_seat_id` parameter for restore flow
  - `force_new` parameter (admin-only) for cascade-delete + create

## Updated Hooks Verified

- `packages/web/src/hooks/use-seats.ts` — Updated to include:
  - `CreateSeatPayload` interface with `restore_seat_id?` and `force_new?` fields
  - `PreviewTokenResponse` interface with `restorable_seat?` field
  - `usePreviewSeatToken()` hook for preview-token endpoint

## Code-to-Docs Synchronization Checklist

- ✅ All new API endpoints documented (profile GET/POST, preview-token)
- ✅ All new shared types included (SeatProfile, RestorableSeat)
- ✅ All new services documented (anthropic-service, seat-cascade-delete)
- ✅ All new components documented (seat-restore-banner, updated seat-form-dialog)
- ✅ Soft-delete behavior clearly explained (partial unique index, restore flow)
- ✅ Profile auto-population and staleness (6h) documented
- ✅ Authorization rules updated (force_new requires admin)
- ✅ Vietnamese UI terminology documented
- ✅ Cascade-delete cleanup path documented (schedules, alerts, usage, sessions, windows, metrics)
- ✅ Atomic restore via findOneAndUpdate documented

## Quality Assurance

- **File Sizes**: All docs remain under typical limits (codebase-summary: 430 LOC, system-architecture: 714 LOC, project-overview-pdr: 201 LOC)
- **Cross-references**: All new endpoints, types, services, components are consistently mentioned across all three docs
- **Accuracy**: All documented functionality verified against actual code implementation
- **Terminology**: Consistent use of Vietnamese UI text and technical terms (soft-delete, cascade-delete, staleness, etc.)
- **Completeness**: No TODO or stale references left in documentation

## Notes

- Profile staleness threshold (6h) is defined as `PROFILE_STALE_MS` constant in seats.ts
- Soft-deleted seats are auto-filtered out by Mongoose pre-hooks unless explicitly queried with `deleted_at` filter
- Email uniqueness constraint uses partialFilterExpression (unique only for deleted_at: null)
- Cascade hard-delete uses Promise.all for concurrent deletion across 7 collections
- Profile fetch failure is non-blocking (returns cached profile as fallback with stale flag)
- Vietnamese restore banner component displays deletion date and usage history availability

## Unresolved Questions

None. All code references have been verified and documentation is current.
