# Phase 2: Backend Middleware + Routes

## Overview
- **Priority:** Critical
- **Status:** Completed
- **Effort:** Medium

Add `requireSeatOwnerOrAdmin` middleware. Update seat routes to use ownership-based auth. Add per-seat credential export and ownership transfer endpoints.

## Related Files
- `packages/api/src/middleware.ts` — modify (add middleware)
- `packages/api/src/routes/seats.ts` — modify (update auth, add endpoints)

## Implementation Steps

### 2.1 Add requireSeatOwnerOrAdmin middleware

In `packages/api/src/middleware.ts`:

```typescript
export function requireSeatOwnerOrAdmin(paramName = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
    if (req.user.role === 'admin') return next()
    
    const seat = await Seat.findById(req.params[paramName])
    if (!seat) return res.status(404).json({ error: 'Seat not found' })
    if (seat.owner_id?.toString() !== req.user._id) {
      return res.status(403).json({ error: 'Not seat owner' })
    }
    next()
  }
}
```

### 2.2 Update POST /api/seats — open to all authenticated users

Current: `requireAdmin`
Change: Remove `requireAdmin`, keep `authenticate` only.

Auto-set `owner_id = req.user._id` in handler.

```typescript
router.post('/', authenticate, async (req, res) => {
  const seat = new Seat({ ...req.body, owner_id: req.user!._id })
  await seat.save()
  res.status(201).json(seat)
})
```

### 2.3 Update existing routes — replace requireAdmin

Replace `requireAdmin` with `requireSeatOwnerOrAdmin()` on these routes:
- `PUT /api/seats/:id` — edit seat
- `DELETE /api/seats/:id` — delete seat
- `POST /api/seats/:id/assign` — assign user
- `DELETE /api/seats/:id/unassign/:userId` — unassign user
- `PUT /api/seats/:id/token` — set credential
- `DELETE /api/seats/:id/token` — remove credential

Keep `requireAdmin` on:
- `GET /api/seats/credentials/export` — bulk export (admin only)

### 2.4 Add per-seat credential export

New endpoint: `GET /api/seats/:id/credentials/export`

```typescript
router.get('/:id/credentials/export',
  authenticate,
  validateObjectId('id'),
  requireSeatOwnerOrAdmin(),
  async (req, res) => {
    // Audit log
    console.log(`[AUDIT] Single credential export seat=${req.params.id} by user=${req.user!.email} ip=${req.ip} at ${new Date().toISOString()}`)
    
    const seat = await Seat.findById(req.params.id).select('+oauth_credential')
    if (!seat?.oauth_credential?.access_token) {
      return res.status(404).json({ error: 'No credential found' })
    }
    
    // Decrypt and return single credential
    // Same format as bulk export but single item
  }
)
```

**IMPORTANT:** This route must be registered BEFORE `/:id` param routes to avoid path conflicts. Place it after the bulk `/credentials/export` route.

### 2.5 Add ownership transfer endpoint

New endpoint: `PUT /api/seats/:id/transfer`

```typescript
router.put('/:id/transfer',
  authenticate,
  requireAdmin,
  validateObjectId('id'),
  async (req, res) => {
    const { new_owner_id } = req.body
    // Validate new_owner_id is valid user
    // Update seat.owner_id
    // Return updated seat
  }
)
```

### 2.6 Update GET /api/seats — include owner info

Populate `owner_id` with `name email` fields in the list query so frontend can display owner.

```typescript
const seats = await Seat.find().populate('owner_id', 'name email')
```

## Todo
- [x] Add `requireSeatOwnerOrAdmin` middleware
- [x] Update POST /seats — remove requireAdmin, auto-set owner_id
- [x] Replace requireAdmin → requireSeatOwnerOrAdmin on 6 routes
- [x] Add GET /seats/:id/credentials/export (per-seat)
- [x] Add PUT /seats/:id/transfer (admin only)
- [x] Update GET /seats — populate owner_id
- [x] Verify route ordering (no path conflicts)

## Success Criteria
- Authenticated user can create seat (becomes owner)
- Owner can edit/delete/manage credential on own seat
- Owner can assign/unassign users on own seat
- Owner can export single seat credential
- Admin can do everything on any seat
- Admin can transfer seat ownership
- Non-owner non-admin gets 403 on protected routes
- Bulk export remains admin-only

## Security Considerations
- Audit log on every credential export (single + bulk)
- Owner cannot transfer ownership (admin only)
- Middleware fetches seat from DB to verify ownership (not trusting client)
