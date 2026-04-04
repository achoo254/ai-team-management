# Phase 2: Backend Routes + Access Control

**Status:** done | **Priority:** high | **Effort:** L
**Depends on:** Phase 1

## Goal
Update teams routes: bỏ admin-only, add ownership check, add members & seats sub-endpoints. Update all other routes consuming team enum.

## Related Files
**Modify:**
- `packages/api/src/routes/teams.ts` — rewrite access control + add sub-endpoints
- `packages/api/src/middleware.ts` — add `requireTeamOwnerOrAdmin`
- `packages/api/src/routes/seats.ts` — use team_id, validate seat-owner ↔ team-owner
- `packages/api/src/routes/dashboard.ts` — query by team_id
- `packages/api/src/routes/admin.ts` — remove team enum refs
- `packages/api/src/routes/auth.ts` — JWT payload update (team_ids)

## Implementation Steps

### 1. Middleware `requireTeamOwnerOrAdmin`
```ts
// middleware.ts
export async function requireTeamOwnerOrAdmin(req, res, next) {
  const team = await Team.findById(req.params.id)
  if (!team) return res.status(404).json({ error: 'Team not found' })
  if (req.user.role === 'admin') { req.team = team; return next() }
  if (team.created_by.toString() !== req.user._id) {
    return res.status(403).json({ error: 'Not team owner' })
  }
  req.team = team; next()
}
```

### 2. Routes `teams.ts` — rewrite
```
GET    /api/teams              auth          → list (admin: all + ?owner filter; user: all public)
POST   /api/teams              auth          → create, auto created_by=self
PUT    /api/teams/:id          teamOwnerOrAdmin → update label/color only
DELETE /api/teams/:id          teamOwnerOrAdmin → block if has seats/users
POST   /api/teams/:id/members       teamOwnerOrAdmin → body {user_id}, push to User.team_ids
DELETE /api/teams/:id/members/:uid  teamOwnerOrAdmin → pull from User.team_ids
POST   /api/teams/:id/seats         teamOwnerOrAdmin → body {seat_id}; also check seat.owner_id === team.created_by (unless admin)
DELETE /api/teams/:id/seats/:sid    teamOwnerOrAdmin → unset Seat.team_id
```

GET query params:
- `?owner=<userId>` (admin only)
- `?mine=true` (created_by=self)
- Default: all teams

Response: populate `created_by` as `creator: { _id, name, email }`.

### 3. Update `seats.ts`
- Replace `team: 'dev'|'mkt'|'personal'` validations with team_id ObjectId checks
- When seat owner changes seat's team → verify team exists + (seat.owner_id === team.created_by OR user is admin)

### 4. Update `dashboard.ts`
- Aggregations group by `team_id` instead of `team` string
- Join with teams collection for display labels

### 5. Update `admin.ts`, `auth.ts`
- JWT payload: `team_ids: string[]` (was `team?: string`)
- Remove all enum validations

### 6. Grep sweep
```bash
grep -rn "'dev'\|'mkt'\|'personal'" packages/api/src packages/web/src
```
Replace all hardcoded refs.

## Todo
- [x] Add requireTeamOwnerOrAdmin middleware
- [x] Rewrite teams.ts routes (GET/POST/PUT/DELETE)
- [x] Add members sub-endpoints
- [x] Add seats sub-endpoints
- [x] Update seats.ts team validation
- [x] Update dashboard.ts aggregations
- [x] Update auth.ts JWT payload
- [x] Grep cleanup hardcoded enums

## Success Criteria
- Regular user creates/edits own team, cannot edit other's team (403)
- Admin edits any team ✓
- `GET /api/teams?owner=X` returns X's teams ✓
- User adds own seat to own team ✓, cannot add other's seat (403) ✓
- Delete team with members/seats → 400 error

## Risks
- JWT payload shape change → user phải re-login (clear cookie)
- Seat.team_id null khi team bị xóa → frontend phải handle null case
