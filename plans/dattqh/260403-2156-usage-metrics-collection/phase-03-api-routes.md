# Phase 3: API Routes

## Context Links
- Plan: `./plan.md`
- Depends on: `./phase-01-models-and-crypto.md`, `./phase-02-collector-service-and-cron.md`

## Overview
- **Priority:** High
- **Status:** completed
- **Description:** Add token management endpoints to seats routes, create usage-snapshots routes for queries + manual trigger.

## Key Insights
- Token management fits in existing seats.ts (extend, not new file) — same resource
- Usage snapshots need own route file — different resource
- Existing pattern: `authenticate` + `requireAdmin` middleware, `mongoose.Types.ObjectId.isValid()` validation
- Token PUT should encrypt before save, GET should never return raw token

## Requirements

### Functional
- Admin can set/update/remove access token per seat
- Admin can trigger usage collection (all or single seat)
- Authenticated users can query usage snapshots (filter by seat, date range)
- Latest snapshot per seat endpoint for dashboard

### Non-functional
- Token never returned in any API response
- Pagination for snapshot queries (limit/offset)

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/api/seats/:id/token` | admin | Set/update encrypted token |
| DELETE | `/api/seats/:id/token` | admin | Remove token, set token_active=false |
| POST | `/api/usage-snapshots/collect` | admin | Trigger collect all seats |
| POST | `/api/usage-snapshots/collect/:seatId` | admin | Trigger collect single seat |
| GET | `/api/usage-snapshots` | auth | Query snapshots with filters |
| GET | `/api/usage-snapshots/latest` | auth | Latest snapshot per active seat |

## Related Code Files

### Modify
- `packages/api/src/routes/seats.ts` — Add PUT/DELETE token endpoints
- `packages/api/src/index.ts` — Register usage-snapshots routes

### Create
- `packages/api/src/routes/usage-snapshots.ts` — New route file

## Implementation Steps

### 1. Add token endpoints to `packages/api/src/routes/seats.ts`

```typescript
import { encrypt } from '../services/crypto-service.js'

// PUT /api/seats/:id/token — set/update access token (admin)
router.put('/:id/token', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

    const { access_token } = req.body
    if (!access_token || typeof access_token !== 'string') {
      res.status(400).json({ error: 'access_token is required' })
      return
    }

    const encrypted = encrypt(access_token)
    const seat = await Seat.findByIdAndUpdate(
      id,
      { access_token: encrypted, token_active: true },
      { new: true, projection: { access_token: 0 } },
    )
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    res.json({ message: 'Token updated', seat })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// DELETE /api/seats/:id/token — remove token (admin)
router.delete('/:id/token', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

    const seat = await Seat.findByIdAndUpdate(
      id,
      { access_token: null, token_active: false, last_fetch_error: null },
      { new: true, projection: { access_token: 0 } },
    )
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    res.json({ message: 'Token removed', seat })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})
```

**Note:** `access_token` auto-excluded by Seat schema `toJSON` transform (Phase 1). No need for `.select('-access_token')` on individual queries. However, `.lean()` bypasses toJSON — for lean queries, still add `.select('-access_token')` or manually strip the field.

### 2. Create `packages/api/src/routes/usage-snapshots.ts`

```typescript
import { Router } from 'express'
import mongoose from 'mongoose'
import { authenticate, requireAdmin } from '../middleware.js'
import { UsageSnapshot } from '../models/usage-snapshot.js'
import { collectAllUsage, collectSeatUsage } from '../services/usage-collector-service.js'

const router = Router()

// POST /api/usage-snapshots/collect — trigger collect all (admin)
router.post('/collect', authenticate, requireAdmin, async (_req, res) => {
  try {
    const result = await collectAllUsage()
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /api/usage-snapshots/collect/:seatId — trigger single seat (admin)
router.post('/collect/:seatId', authenticate, requireAdmin, async (req, res) => {
  try {
    const { seatId } = req.params
    if (!mongoose.Types.ObjectId.isValid(seatId)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }
    await collectSeatUsage(seatId)
    res.json({ message: 'Usage collected' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/usage-snapshots — query snapshots (auth)
// Query: ?seatId=&from=ISO&to=ISO&limit=50&offset=0&includeRaw=true
router.get('/', authenticate, async (req, res) => {
  try {
    const { seatId, from, to, limit = '50', offset = '0', includeRaw } = req.query
    const filter: Record<string, unknown> = {}

    if (seatId && mongoose.Types.ObjectId.isValid(seatId as string)) {
      filter.seat_id = seatId
    }
    if (from || to) {
      filter.fetched_at = {}
      if (from) (filter.fetched_at as any).$gte = new Date(from as string)
      if (to) (filter.fetched_at as any).$lte = new Date(to as string)
    }

    // Exclude raw_response by default to reduce payload size
    const projection = includeRaw === 'true' ? {} : { raw_response: 0 }

    const [snapshots, total] = await Promise.all([
      UsageSnapshot.find(filter, projection)
        .sort({ fetched_at: -1 })
        .limit(Math.min(Number(limit), 200))
        .skip(Number(offset))
        .lean(),
      UsageSnapshot.countDocuments(filter),
    ])

    res.json({ snapshots, total })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /api/usage-snapshots/latest — latest per active seat (auth)
router.get('/latest', authenticate, async (_req, res) => {
  try {
    // Optimized: filter last 24h first, then group — uses compound index
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const latest = await UsageSnapshot.aggregate([
      { $match: { fetched_at: { $gte: oneDayAgo } } },
      { $sort: { fetched_at: -1 } },
      { $group: {
        _id: '$seat_id',
        snapshot: { $first: '$$ROOT' },
      }},
      { $replaceRoot: { newRoot: '$snapshot' } },
      { $project: { raw_response: 0 } },  // exclude raw from latest view
      { $sort: { seat_id: 1 } },
    ])

    res.json({ snapshots: latest })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

export default router
```

### 3. Register routes in `packages/api/src/index.ts`

```typescript
import usageSnapshotRoutes from './routes/usage-snapshots.js'

// Add after existing route registrations:
app.use('/api/usage-snapshots', usageSnapshotRoutes)
```

## Todo List
- [x] Add PUT/DELETE token endpoints to seats.ts
- [x] Exclude access_token from GET /api/seats response
- [x] Create usage-snapshots.ts route file
- [x] Register route in index.ts
- [x] Test: set token → trigger collect → query snapshots
- [x] Verify compile passes

## Success Criteria
- Token set/remove works, never returned in response
- Manual trigger (all + single) returns success/error counts
- Query supports seatId, date range, pagination
- Latest endpoint returns 1 snapshot per seat
- Existing seat endpoints unaffected

## Risk Assessment
- **Long-running collect on manual trigger**: Could timeout if many seats. Acceptable for 5-20 seats (~3-10s)
- **access_token leak**: Projection `-access_token` on all seat queries that return data

## Security Considerations
- Token endpoints admin-only
- access_token auto-excluded via Seat schema toJSON transform (Phase 1)
- For `.lean()` queries: use `.select('-access_token')` since lean bypasses transforms
- raw_response excluded from list/latest endpoints by default (opt-in via `?includeRaw=true`)
- Snapshot collect endpoints admin-only
- Query endpoints require auth (any role)
