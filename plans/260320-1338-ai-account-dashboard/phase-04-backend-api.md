# Phase 4: Backend API

**Priority:** High | **Status:** pending | **Effort:** 1 day

## Overview
Express REST API cho dashboard frontend.

## Auth
- JWT token-based, stored in httpOnly cookie
- Admin (dattqh) can CRUD all, Users read-only + manage own schedule

## Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/login | Public | Login → JWT cookie |
| POST | /api/auth/logout | Any | Clear cookie |
| GET | /api/auth/me | Any | Current user info |

### Dashboard
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/dashboard/summary | Any | Tổng quan: total tokens, cost, sessions hôm nay/tuần |
| GET | /api/dashboard/usage?from=&to= | Any | Usage logs theo date range |
| GET | /api/dashboard/usage/by-seat | Any | Aggregate usage per seat |
| GET | /api/dashboard/usage/by-user | Admin | Aggregate usage per user (email) |

### Seats
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/seats | Any | List all seats with assigned users |
| PUT | /api/seats/:id | Admin | Update seat info |
| POST | /api/seats/:id/assign | Admin | Assign user to seat |
| DELETE | /api/seats/:id/unassign/:userId | Admin | Remove user from seat |

### Schedules
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/schedules | Any | All schedules (or filter by seat) |
| GET | /api/schedules/today | Any | Today's schedule |
| PUT | /api/schedules/:seatId | Admin | Update schedule for a seat |

### Alerts
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/alerts | Any | Active alerts |
| PUT | /api/alerts/:id/resolve | Admin | Mark alert resolved |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/sync | Admin | Manual trigger usage sync |
| GET | /api/users | Admin | List all users |
| POST | /api/users | Admin | Create user |
| PUT | /api/users/:id | Admin | Update user |
| DELETE | /api/users/:id | Admin | Delete user |

## Implementation Steps
- [ ] Create `server/middleware/auth-middleware.js` — JWT verify + role check
- [ ] Create `server/routes/auth-routes.js` — login/logout/me
- [ ] Create `server/routes/dashboard-routes.js` — usage queries with date filters
- [ ] Create `server/routes/seat-routes.js` — seat CRUD
- [ ] Create `server/routes/schedule-routes.js` — schedule management
- [ ] Create `server/routes/admin-routes.js` — sync, user management, alerts
- [ ] Wire all routes in `server/index.js`

## Success Criteria
- All endpoints return correct data
- Auth middleware blocks unauthorized access
- Admin-only endpoints reject user role
- Date range queries work correctly
