# Documentation Update: Schedule Seat-Based Permissions
**Date:** 2026-04-04 | **Agent:** docs-manager

## Summary
Updated project documentation to reflect the new "Schedule Seat-Based Permissions" feature implementation. Changes are minimal and focused on new code elements without removing or contradicting existing sections.

## Changes Made

### 1. system-architecture.md (+51 lines)
**Added new section** after "Authorization Hierarchy" → "Schedule Permissions (Per-Seat & Role-Based)"

Covers:
- Permission types (7 flags: canView, canCreate, canCreateForOthers, canSwap, canClearAll, canEditEntry, canDeleteEntry)
- Role-based matrix showing which actions each role can perform
- Implementation details: where resolver lives, how API/UI use it, performance note (no DB calls in resolver)
- Sources: `packages/shared/schedule-permissions.ts::resolveSchedulePermissions()`

**Lines:** 689 total (under 800 LOC limit)

### 2. codebase-summary.md (+13 lines)
**Updated section** "Directory Structure" → packages/shared subsection
- Added reference to new `schedule-permissions.ts` file
- Added note to types.ts about SchedulePermissions interface

**Updated section** "Key Data Structures" → added SchedulePermissions TypeScript interface definition

**Updated section** "API Endpoints" → Schedules subsection
- Replaced 3 old endpoints with 6 new permission-based routes
- Added route names and permission checks each uses
- Clarified filtering behavior (membership + ownership)

**Lines:** 428 total (under 800 LOC limit)

### 3. code-standards.md
**No changes** — existing code patterns already cover:
- Service layer exports (schedule-permissions is exported utility)
- TypeScript typing conventions (SchedulePermissions interface)
- Middleware/permission checks (already documented)

## Documentation Verification

All updates verified against actual codebase:
- ✅ `packages/shared/schedule-permissions.ts` exists with `resolveSchedulePermissions()` function
- ✅ `packages/shared/types.ts` contains `SchedulePermissions` interface (lines 141-150)
- ✅ `packages/api/src/routes/schedules.ts` uses permission resolver via `getPermissionCtx()`
- ✅ All 6 routes documented exist in code
- ✅ Role-based matrix matches code behavior in `resolveSchedulePermissions()` function

## Accuracy Notes

Permission matrix validated against schedule-permissions.ts logic:
- Admin: all flags true except canClearAll is checking `isAdmin` only → matches "Yes" in matrix
- Seat Owner: canCreateForOthers/canSwap/canEditEntry/canDeleteEntry check `isOwner` → matches matrix
- Member: canCreate=true, canEditEntry/canDeleteEntry check `user_id === ctx.userId` → matches "Self only" / "Own entries"
- Non-member: all false (early return) → matches "No"

API implementation confirmed:
- `getPermissionCtx()` calls `resolveSchedulePermissions()` with correct context
- All 6 routes use this resolver before allowing operations
- No hardcoded role checks in routes; all delegated to resolver

## File Size Status

| File | Lines | Limit | Status |
|------|-------|-------|--------|
| system-architecture.md | 689 | 800 | ✅ OK |
| codebase-summary.md | 428 | 800 | ✅ OK |
| code-standards.md | 440 | 800 | ✅ OK |

## Related Code Files (Read-Only, Not Modified)
- `packages/shared/schedule-permissions.ts` (35 lines)
- `packages/shared/types.ts` (SchedulePermissions interface)
- `packages/api/src/routes/schedules.ts` (300+ lines)

## Unresolved Questions
None — feature is complete, documentation fully synchronized.
