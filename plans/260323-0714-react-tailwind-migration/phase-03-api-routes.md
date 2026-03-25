# Phase 3: API Route Handlers

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 2.5 days
- **Description:** Migrate 40+ Express routes → Next.js Route Handlers. Giữ nguyên logic, đổi format.

## Key Insights
- Express: `(req, res) => {}` → Next.js: `(request: NextRequest) => NextResponse`
- Express middleware chain → Next.js: call auth helpers inline
- Express `req.params.id` → Next.js: `params` argument in handler
- Express `req.query` → Next.js: `request.nextUrl.searchParams`
- Express `req.body` → Next.js: `await request.json()`
- Express `res.json()` → Next.js: `NextResponse.json()`
- Express `res.cookie()` → Next.js: `response.cookies.set()`

## Requirements

### Functional
- All 40+ endpoints migrated with identical behavior
- Auth middleware applied consistently
- Same HTTP status codes and error responses
- Same request/response JSON shapes

### Non-functional
- Each route file < 100 lines (split large files)
- Consistent error handling pattern
- connectDb() called at top of each handler

## Architecture

```
app/api/
├── auth/
│   ├── google/route.ts        # POST: Firebase verify → JWT
│   ├── logout/route.ts        # POST: Clear cookie
│   └── me/route.ts            # GET: Current user
├── dashboard/
│   ├── summary/route.ts       # GET: KPI summary
│   ├── usage/by-seat/route.ts # GET: Usage by seat
│   └── enhanced/route.ts      # GET: Full dashboard data
├── seats/
│   ├── route.ts               # GET, POST
│   └── [id]/
│       ├── route.ts           # PUT, DELETE
│       ├── assign/route.ts    # POST
│       └── unassign/
│           └── [userId]/route.ts  # DELETE
├── schedules/
│   ├── route.ts               # GET
│   ├── today/route.ts         # GET
│   ├── [seatId]/route.ts      # PUT (bulk replace)
│   ├── assign/route.ts        # POST
│   ├── swap/route.ts          # PATCH
│   ├── entry/route.ts         # DELETE
│   └── all/route.ts           # DELETE
├── alerts/
│   ├── route.ts               # GET
│   └── [id]/
│       └── resolve/route.ts   # PUT
├── admin/
│   ├── users/
│   │   ├── route.ts           # GET, POST
│   │   ├── [id]/route.ts      # PUT, DELETE
│   │   └── bulk-active/route.ts  # PATCH
│   ├── check-alerts/route.ts  # POST
│   └── send-report/route.ts   # POST
├── teams/
│   ├── route.ts               # GET, POST
│   └── [id]/route.ts          # PUT, DELETE
└── usage-log/
    ├── bulk/route.ts          # POST
    └── week/route.ts          # GET
```

## Implementation Steps

1. **Create helper wrapper** `lib/api-helpers.ts`
   ```typescript
   import { connectDb } from './mongoose'
   import { getAuthUser } from './auth'

   export async function withAuth(request: NextRequest) {
     await connectDb()
     const user = await getAuthUser(request)
     if (!user) throw new ApiError(401, 'Authentication required')
     return user
   }

   export async function withAdmin(request: NextRequest) {
     const user = await withAuth(request)
     if (user.role !== 'admin') throw new ApiError(403, 'Admin access required')
     return user
   }

   export function errorResponse(error: unknown) {
     if (error instanceof ApiError)
       return NextResponse.json({ error: error.message }, { status: error.status })
     return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
   }
   ```

2. **Migrate auth routes** (3 endpoints)
   - `POST /api/auth/google` — Firebase verify idToken → sign JWT → set cookie
   - `POST /api/auth/logout` — Clear token cookie
   - `GET /api/auth/me` — Return user from JWT

3. **Migrate dashboard routes** (3 endpoints)
   - `GET /api/dashboard/summary` — Aggregation: avg usage, alert count
   - `GET /api/dashboard/usage/by-seat` — Latest weekly % per seat
   - `GET /api/dashboard/enhanced` — Full metrics with 8-week trend

4. **Migrate seat routes** (6 endpoints)
   - CRUD + assign/unassign with cascading schedule cleanup

5. **Migrate schedule routes** (7 endpoints)
   - Including bulk replace, swap, assign, delete entry/all

6. **Migrate alert routes** (2 endpoints)
   - List with filter + resolve

7. **Migrate admin routes** (7 endpoints)
   - User CRUD + bulk-active + check-alerts + send-report
   - Rate limiting for send-report (60s cooldown)

8. **Migrate team routes** (4 endpoints)
   - CRUD with empty-check on delete

9. **Migrate usage-log routes** (2 endpoints)
   - Bulk log + week query

10. **Test all endpoints** with REST client
    - Verify auth flow (401/403)
    - Verify CRUD operations
    - Verify aggregation responses match current format

## Endpoint Migration Checklist

### Auth (3)
- [ ] POST /api/auth/google
- [ ] POST /api/auth/logout
- [ ] GET /api/auth/me

### Dashboard (3)
- [ ] GET /api/dashboard/summary
- [ ] GET /api/dashboard/usage/by-seat
- [ ] GET /api/dashboard/enhanced

### Seats (6)
- [ ] GET /api/seats
- [ ] POST /api/seats
- [ ] PUT /api/seats/[id]
- [ ] DELETE /api/seats/[id]
- [ ] POST /api/seats/[id]/assign
- [ ] DELETE /api/seats/[id]/unassign/[userId]

### Schedules (7)
- [ ] GET /api/schedules
- [ ] GET /api/schedules/today
- [ ] PUT /api/schedules/[seatId]
- [ ] POST /api/schedules/assign
- [ ] PATCH /api/schedules/swap
- [ ] DELETE /api/schedules/entry
- [ ] DELETE /api/schedules/all

### Alerts (2)
- [ ] GET /api/alerts
- [ ] PUT /api/alerts/[id]/resolve

### Admin (7)
- [ ] GET /api/admin/users
- [ ] POST /api/admin/users
- [ ] PUT /api/admin/users/[id]
- [ ] DELETE /api/admin/users/[id]
- [ ] PATCH /api/admin/users/bulk-active
- [ ] POST /api/admin/check-alerts
- [ ] POST /api/admin/send-report

### Teams (4)
- [ ] GET /api/teams
- [ ] POST /api/teams
- [ ] PUT /api/teams/[id]
- [ ] DELETE /api/teams/[id]

### Usage Log (2)
- [ ] POST /api/usage-log/bulk
- [ ] GET /api/usage-log/week

## Success Criteria
- All 34 endpoints return same response shape as Express version
- Auth gating (401/403) works correctly
- MongoDB queries produce identical results
- Error handling consistent (duplicate → 409, not found → 404, validation → 400)

## Risk Assessment
- **ObjectId validation**: Use mongoose.isValidObjectId() instead of middleware
- **Cookie handling**: NextResponse.cookies API differs from Express res.cookie()
- **Rate limiting**: send-report 60s cooldown needs in-memory or cache approach

## Next Steps
→ Phase 4: Auth flow & layout UI
