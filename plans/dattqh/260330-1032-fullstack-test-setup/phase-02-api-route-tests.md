---
phase: 2
priority: critical
status: completed
effort: M
---

# Phase 2: API Route Tests

## Overview

Test Next.js API routes directly by importing route handlers. No HTTP server needed — call `GET()`, `POST()`, etc. directly with mocked `NextRequest`.

## Context

- API routes: `app/api/{resource}/route.ts` export async `GET`, `POST`, `PUT`, `DELETE`
- Auth: `withAuth(request)` / `withAdmin(request)` reads JWT from cookie/header
- All routes use `errorResponse()` for error handling
- Real MongoDB — seed data before tests, clean after

## Test Pattern

```ts
import { GET, POST } from "@/app/api/seats/route";
import { NextRequest } from "next/server";
import { createTestToken } from "../helpers/auth-helper";
import { cleanDb, seedTestData } from "../helpers/db-helper";

function makeRequest(url: string, options?: RequestInit & { token?: string }) {
  const { token, ...init } = options || {};
  const req = new NextRequest(new URL(url, "http://localhost:3000"), init);
  if (token) req.headers.set("authorization", `Bearer ${token}`);
  return req;
}
```

## API Routes to Test

### Priority 1: Auth (security critical)

**File:** `tests/api/auth.test.ts`

| Endpoint | Tests |
|----------|-------|
| `POST /api/auth/google` | Valid idToken → JWT cookie set, invalid → 401 |
| `GET /api/auth/me` | Valid JWT → user info, no JWT → 401 |
| `POST /api/auth/logout` | Clears cookie |

**Note:** Firebase `verifyIdToken` needs mocking — only external dependency we mock.

### Priority 2: Seats CRUD (core business)

**File:** `tests/api/seats.test.ts`

| Endpoint | Tests |
|----------|-------|
| `GET /api/seats` | Auth required, returns seats with users |
| `POST /api/seats` | Admin only, creates seat, validates required fields |
| `PUT /api/seats/[id]` | Admin only, updates seat |
| `DELETE /api/seats/[id]` | Admin only, deletes seat + unassigns users |
| `POST /api/seats/[id]/assign` | Assigns user to seat |
| `POST /api/seats/[id]/unassign/[userId]` | Unassigns user |

### Priority 3: Teams, Schedules, Alerts, Usage Log

**Files:** `tests/api/teams.test.ts`, `tests/api/schedules.test.ts`, `tests/api/alerts.test.ts`, `tests/api/usage-log.test.ts`

Same pattern: auth/admin guards, CRUD operations, validation, error cases.

### Priority 4: Dashboard

**File:** `tests/api/dashboard.test.ts`

| Endpoint | Tests |
|----------|-------|
| `GET /api/dashboard/summary` | Returns correct stats from seeded data |
| `GET /api/dashboard/enhanced` | Returns usage trends, team breakdown |
| `GET /api/dashboard/usage/by-seat` | Returns per-seat usage data |

### Priority 5: Admin

**File:** `tests/api/admin.test.ts`

| Endpoint | Tests |
|----------|-------|
| `GET /api/admin/users` | Admin only, list all users |
| `PUT /api/admin/users/[id]` | Admin only, update user role/team |
| `POST /api/admin/check-alerts` | Triggers alert check |
| `POST /api/admin/send-report` | Triggers report generation |

## Mock Strategy

| Dependency | Strategy |
|------------|----------|
| MongoDB/Mongoose | **Real** — connect to test DB |
| JWT auth | **Real** — generate tokens with test secret |
| Firebase Admin | **Mock** `verifyIdToken` only (external service) |
| Telegram | **Mock** — no real API calls in tests |
| Anthropic | **Mock** — no real API calls in tests |

## Files to Create

- `tests/helpers/request-helper.ts` — `makeRequest()` utility
- `tests/api/auth.test.ts`
- `tests/api/seats.test.ts`
- `tests/api/teams.test.ts`
- `tests/api/schedules.test.ts`
- `tests/api/alerts.test.ts`
- `tests/api/usage-log.test.ts`
- `tests/api/dashboard.test.ts`
- `tests/api/admin.test.ts`

## Success Criteria

- [ ] All API routes have at least 1 happy path + 1 error test
- [ ] Auth guards tested (401 for no token, 403 for non-admin)
- [ ] CRUD operations verified against real MongoDB
- [ ] No external service calls (Firebase, Telegram, Anthropic mocked)
