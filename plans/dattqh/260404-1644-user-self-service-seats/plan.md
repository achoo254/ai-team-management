---
title: User Self-Service Seat Management
status: completed
created: 2026-04-04
completed: 2026-04-04
blockedBy: []
blocks: []
---

# User Self-Service Seat Management

## Overview

Allow users to create and manage their own seats. Add `owner_id` to Seat model, replace admin-only middleware with owner-or-admin checks, add per-seat credential export, and update frontend to show ownership context.

## Brainstorm Report
- `plans/dattqh/reports/brainstorm-260404-1644-user-self-service-seat-management.md`

## Permission Matrix

| Action | Admin | Owner | Assigned | Other |
|--------|-------|-------|----------|-------|
| View seats | all | own | assigned | basic info |
| Create seat | ✓ | — | — | ✓ (becomes owner) |
| Edit/Delete | any | own | ✗ | ✗ |
| Credential mgmt | any | own | ✗ | ✗ |
| Per-seat export | any | own | ✗ | ✗ |
| Assign/Unassign | any | own | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ | ✗ |
| Bulk export | ✓ | ✗ | ✗ | ✗ |

## Phases

| # | Phase | Status | Priority | Effort |
|---|-------|--------|----------|--------|
| 1 | [Schema + Migration](phase-01-schema-migration.md) | completed | critical | small |
| 2 | [Backend Middleware + Routes](phase-02-backend-routes.md) | completed | critical | medium |
| 3 | [Shared Types](phase-03-shared-types.md) | completed | high | small |
| 4 | [Frontend UI](phase-04-frontend-ui.md) | completed | high | medium |
| 5 | [Testing](phase-05-testing.md) | completed | high | small |

## Key Files

### Modify
- `packages/api/src/models/seat.ts` — add owner_id field
- `packages/api/src/middleware.ts` — add requireSeatOwnerOrAdmin
- `packages/api/src/routes/seats.ts` — update auth, add per-seat export + transfer
- `packages/shared/types.ts` — add owner fields to Seat type
- `packages/web/src/pages/seats.tsx` — grouped sections, owner UI
- `packages/web/src/components/seat-card.tsx` — owner badge, conditional actions
- `packages/web/src/hooks/use-seats.ts` — add per-seat export, transfer hooks

### Create
- `packages/api/src/scripts/migrate-seat-owners.ts` — one-time migration script

## Dependencies
- None (all prior plans completed)

## Risk
- Migration: existing seats get admin as owner — idempotent, rollback = remove field
- Permission gap: ensure no route misses the middleware swap
- Frontend: conditional rendering must handle ownerless seats gracefully
