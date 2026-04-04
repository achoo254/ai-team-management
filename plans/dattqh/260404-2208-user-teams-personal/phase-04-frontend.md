# Phase 4: Frontend (Pages + Components + Hooks)

**Status:** pending | **Priority:** high | **Effort:** L
**Depends on:** Phase 2

## Goal
UI hỗ trợ user tạo team, manage members, admin filter by owner. Update mọi chỗ dùng team enum.

## Related Files
**Modify:**
- `packages/web/src/pages/teams.tsx` — all-teams view + owner badge + admin filter
- `packages/web/src/components/team-card.tsx` — show creator, conditional actions
- `packages/web/src/components/team-form-dialog.tsx` — add Members + Seats tabs
- `packages/web/src/hooks/use-teams.ts` — add members/seats hooks
- `packages/web/src/pages/seats.tsx` — dynamic team dropdown
- `packages/web/src/components/seat-card.tsx` — display team from team_id
- `packages/web/src/components/dashboard-team-stats.tsx` — fetch teams dynamically
- `packages/shared/types.ts` (already updated Phase 1)

**Create:**
- `packages/web/src/components/team-members-manager.tsx` — members add/remove UI
- `packages/web/src/components/team-seats-manager.tsx` — seats add/remove UI

## Implementation Steps

### 1. Hooks `use-teams.ts` — add
```ts
useTeams({ owner?: string, mine?: boolean })
useTeamMembers(teamId)           // GET users where team_ids contains teamId
useTeamSeats(teamId)             // GET seats where team_id === teamId
useAddMember()   // POST /teams/:id/members
useRemoveMember()// DELETE /teams/:id/members/:uid
useAddTeamSeat() // POST /teams/:id/seats
useRemoveTeamSeat() // DELETE /teams/:id/seats/:sid
```

### 2. Teams page (`pages/teams.tsx`)
- Show **all teams** (not admin-only)
- Create button visible to all authenticated users
- Filter section (admin only):
  - Select: "Filter by owner" (list of users)
  - Toggle: "Show only mine"
- Card grid: show team + creator badge "by {email}"

### 3. Team card (`team-card.tsx`)
- Display creator name/email
- Edit/Delete buttons visible if `team.created_by === currentUser._id || currentUser.role === 'admin'`
- Members count + Seats count

### 4. Team form dialog (`team-form-dialog.tsx`)
- Tab 1: Info (name, label, color — existing)
- Tab 2: Members — list users, add/remove (only if team exists, i.e., edit mode)
- Tab 3: Seats — list user's own seats (or all if admin), check to include in team

### 5. Members manager (`team-members-manager.tsx`)
- List current members with Remove button
- Search input + add-user autocomplete
- Confirm dialog before remove
- Toast on success/error

### 6. Seats manager (`team-seats-manager.tsx`)
- List seats where team_id === this team
- Add: multi-select seats (user only sees own seats unless admin)
- Remove: unset team_id

### 7. Seats page updates
- Team column: display `team.label` from team_id lookup
- Seat form: dropdown team from `useTeams({ mine: true })` (only user's teams)
- Admin can pick any team

### 8. Dashboard team stats
- Replace hardcoded 3 teams with dynamic `useTeams()` iteration
- Group aggregation by team_id

## Todo
- [ ] Add new hooks in use-teams.ts
- [ ] Update types import (Seat.team_id, User.team_ids)
- [ ] Teams page: all-teams view + admin filter
- [ ] Team card: creator badge + conditional actions
- [ ] Team form dialog: 3-tab layout
- [ ] team-members-manager component
- [ ] team-seats-manager component
- [ ] Seats page: dynamic team dropdown
- [ ] Dashboard team stats: dynamic fetch
- [ ] Grep cleanup `'dev'|'mkt'|'personal'` in web package

## Success Criteria
- User tạo team → thấy trong list with "by me" badge
- User cannot edit/delete team của người khác (button hidden)
- Admin thấy filter "Filter by owner" dropdown
- Seat form dropdown chỉ show teams user tạo (admin thấy all)
- Dashboard team stats render đúng với team động

## Risks
- Teams trùng tên gây confusion → always show creator name
- Backward-incompat JWT → toast "please re-login" nếu 401 sau migration
