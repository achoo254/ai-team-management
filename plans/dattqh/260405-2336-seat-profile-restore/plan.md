---
title: "Seat Profile API + Restore Flow"
description: "Cache Anthropic profile on seats; allow restoring soft-deleted seats when re-adding same email"
status: complete
priority: P2
effort: 5h
branch: main
tags: [api, seats, profile, restore]
created: 2026-04-05
---

# Seat Profile API + Restore Flow

## Summary

Two features: (1) Cache Anthropic OAuth profile data on Seat model with auto-fetch + manual refresh endpoints. (2) When creating a seat whose email matches a soft-deleted seat, offer restore-or-replace choice instead of silent failure.

## Phases

| # | Phase | File | Status | Est |
|---|-------|------|--------|-----|
| 1 | Shared types | [phase-01-shared-types.md](phase-01-shared-types.md) | Done | 0.5h |
| 2 | API: Seat model + profile endpoints | [phase-02-api-seat-profile.md](phase-02-api-seat-profile.md) | Done | 1.5h |
| 3 | API: Restore flow in POST /seats | [phase-03-api-seat-restore.md](phase-03-api-seat-restore.md) | Done | 1.5h |
| 4 | Web: Restore dialog + hook updates | [phase-04-web-restore-ui.md](phase-04-web-restore-ui.md) | Done | 1.5h |

## Dependency Graph

```
Phase 1 (shared types)
  ├──> Phase 2 (API profile)
  └──> Phase 3 (API restore) ──> Phase 4 (Web restore UI)
```

Phase 1 is prerequisite for all. Phase 2 and 3 can run in parallel. Phase 4 depends on Phase 3.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Anthropic profile API rate limit | Low | Med | Cache with 6h staleness; no auto-retry on 429 |
| Soft-deleted seat has stale/corrupt data | Low | Med | Restore only updates credential + owner; does NOT touch historical data |
| Race condition: two users try to restore same seat | Low | Low | `findOneAndUpdate` with `deleted_at: { $ne: null }` filter atomically claims it |
| `seat-form-dialog.tsx` already 309 LOC | Med | Med | Extract restore dialog to separate component `seat-restore-dialog.tsx` |

## Rollback Plan

- Phase 1-2: Remove `profile` field from schema; Mongoose ignores unknown fields so existing data unaffected
- Phase 3: Revert POST /seats route changes; soft-deleted seats remain untouched
- Phase 4: Revert FE files; no persistent state changes

## Backwards Compatibility

- `profile` field is optional/nullable — existing seats work without it
- `restore_seat_id` / `force_new` are optional body params — existing create calls unaffected
- `preview-token` response adds optional `restorable_seat` field — FE gracefully ignores if not present
- No migration needed; profile populates lazily on first access

## Test Matrix

| Layer | What | How |
|-------|------|-----|
| Unit | `toProfileCache()` mapper | Vitest, mock OAuthProfile input |
| Integration | GET /seats/:id/profile, POST refresh | In-memory Mongo, mock fetchOAuthProfile |
| Integration | POST /seats with restore_seat_id | In-memory Mongo, verify soft-deleted seat restored |
| Integration | POST /seats with force_new | Verify cascade delete + new seat created |
| E2E (manual) | Create seat → delete → re-add same token → restore dialog | Browser |
