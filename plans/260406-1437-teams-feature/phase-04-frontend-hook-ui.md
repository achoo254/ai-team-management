---
phase: 4
status: completed
priority: medium
effort: 2h
completedDate: 2026-04-06
---

# Phase 4: Frontend — Hook + UI

## Overview

Create React Query hook for teams CRUD and a teams management page/section. Follow existing hook pattern from `use-seats.ts`.

## Context Links

- Hook pattern: `packages/web/src/hooks/use-seats.ts`
- Page pattern: `packages/web/src/pages/seats.tsx`
- API client: `packages/web/src/lib/api-client.ts`
- App router: `packages/web/src/app.tsx`

## Files to Create

### `packages/web/src/hooks/use-teams.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Team } from '@repo/shared/types'
import { toast } from 'sonner'

const KEY = ['teams']

export function useTeams() {
  return useQuery<{ teams: Team[] }>({
    queryKey: KEY,
    queryFn: () => api.get('/api/teams'),
  })
}

export function useCreateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; description?: string; seat_ids?: string[]; member_ids?: string[] }) =>
      api.post('/api/teams', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Tạo team thành công') },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string; seat_ids?: string[]; member_ids?: string[] }) =>
      api.put(`/api/teams/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Cập nhật team thành công') },
    onError: (e: Error) => toast.error(e.message),
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/teams/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); toast.success('Xóa team thành công') },
    onError: (e: Error) => toast.error(e.message),
  })
}
```

### `packages/web/src/pages/teams.tsx`

Teams management page with:
- List all teams user belongs to / owns
- Create team dialog (name, description, select seats, select members)
- Edit team (add/remove seats, add/remove members)
- Delete team with confirm dialog

Use existing UI patterns:
- shadcn/ui Dialog, Button, Input, Badge
- Multi-select for seats and members (reuse available-users pattern from seats page)
- Confirm dialog for delete

### Route Registration

Add to `packages/web/src/app.tsx`:
```typescript
import TeamsPage from './pages/teams'
// In router:
<Route path="/teams" element={<TeamsPage />} />
```

Add navigation link in sidebar/nav component.

## Implementation Steps

1. Create `packages/web/src/hooks/use-teams.ts`
2. Create `packages/web/src/pages/teams.tsx` with list + CRUD UI
3. Register route in `app.tsx`
4. Add nav link to teams page
5. Run `pnpm dev:web` to verify renders

## Success Criteria

- [x] Teams page lists all user teams
- [x] Can create team with name + seats + members
- [x] Can edit team membership and seats
- [x] Can delete team with confirmation
- [x] Seat owner only sees own seats in seat picker
- [x] Admin sees all seats in seat picker
- [x] Nav link added to main navigation
- [x] Form validation applied (name required, maxlength constraints)
