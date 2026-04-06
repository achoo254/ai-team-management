---
phase: 3
status: completed
priority: medium
effort: 0.5h
completedDate: 2026-04-06
---

# Phase 3: Shared Types

## Overview

Add Team type to `packages/shared/types.ts` for use by both API and web.

## Files to Modify

### `packages/shared/types.ts`

Add after existing interfaces:

```typescript
export interface Team {
  _id: string
  name: string
  description: string | null
  seat_ids: string[]        // or populated Seat[]
  member_ids: string[]      // or populated User[]
  owner_id: string
  owner?: { _id: string; name: string; email: string } | null
  members?: { _id: string; name: string; email: string }[]
  seats?: { _id: string; label: string; email: string }[]
  created_at: string
}
```

## Implementation Steps

1. Add `Team` interface to `packages/shared/types.ts`
2. Run `pnpm build` to verify no type conflicts

## Success Criteria

- [x] Team type exported from shared package
- [x] Both web and api can import it
