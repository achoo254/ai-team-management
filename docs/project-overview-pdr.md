# quan-ly-team-claude: Project Overview & PDR

## Purpose

Internal dashboard for managing Claude Teams accounts. Centralizes seat allocation, real-time activity tracking, usage monitoring, intelligent alerts, and multi-channel notifications—enabling team leads to optimize seat utilization and prevent service disruptions.

## Target Users

- **Admins**: Allocate seats, manage users, configure alerts, view reports
- **Developers & Marketers**: Log weekly usage, view schedules, check seat availability
- **Team Lead**: Monitor usage patterns, receive alerts on high usage/inactivity

## Key Features

### 1. Seat Management
- Create/update/delete Claude Teams seats
- Soft-delete with restore capability (restore_seat_id)
- Admin force-new mode: cascade-delete old seat + create fresh (force_new)
- Auto-populate seat profile on token setup (account_name, org_name, rate_limit_tier, subscription status)
- Get/refresh cached profile (6h staleness threshold)
- Assign seats to dev or mkt team
- Track seat capacity (max users per seat)
- View seat status and current users
- Admin overview toggle (include_in_overview) for BLD metrics

### 2. Activity Patterns (Auto-Generated Heatmap - Read-Only)
- Real-time activity tracking: 5-min cron detects usage deltas, populates SeatActivityLog (hourly resolution)
- Daily pattern generation (04:00 ASI/Saigon): Analyzes 2-4 weeks of activity, generates recurring 7x24 grids
- Activity heatmap visualization: Aggregated by day/hour, shows activity_rate (% of days active), avg/max usage delta
- Realtime activity status: Current hour activity indicator + snapshot staleness warnings

### 3. Alerts (Real-time, Per-User-Per-Seat)
- **Rate Limit**: Trigger when seat usage exceeds threshold (default 80%) for 5h or 7d windows
- **Token Failure**: Trigger for seats with active tokens but failed API fetch
- **Usage Exceeded**: Reserved for future per-user session tracking (current: not actively used)
- **Session Waste**: Reserved for anomaly detection on unusual activity patterns
- **7d Risk**: Reserved for predictive alerts on trending usage
- Per-user deduplication: max 1 unresolved alert per (user, seat, type, window)
- Notification tracking: notified_at field prevents re-sending for same condition
- Audit trail: read_by array tracks which users marked alert as read

### 4. Telegram Notifications
- **Weekly Report** (Friday 17:00 Asia/Saigon): Usage summary from snapshots, alerts, inactive users
- Integration via Telegram bot + topic

### 5. User & Team Management
- Create/update users (name, email, role, team)
- **Teams Feature**: Create/edit/delete team groups; team = view-only grouping of seats for organizational clarity
  - Any authenticated user can create a team; non-admin restricted to adding seats they own
  - Team owner or admin can manage team members and seats
  - Teams enable users to view grouped seats together; alerts/schedule still require individual seat_ids
  - Soft-deleted seats auto-removed from teams
- Admin role gating for sensitive operations

### 6. Usage Metrics Collection
- Store Anthropic API access tokens (encrypted with AES-256-GCM)
- Auto-collect usage every 5 minutes for all active seats
- Track 5-hour, 7-day, and model-specific (Sonnet, Opus) utilization %
- Monitor extra_usage credits (monthly limit, used, utilization)
- Query and filter usage snapshots by seat and date range
- View latest metrics (within 24h) with status indicators
- Automatic cleanup: snapshots deleted after 90 days

### 7. Seat Ownership & Per-User Settings
- Each seat has an owner (user who created it)
- Owner can manage seat details, users, and tokens
- Admin can also manage any seat (except credential export of others' seats)
- Each user has alert settings (thresholds for rate_limit, extra_credit)
- Each user watches specific seats for alerts (watched_seat_ids)
- Personal Telegram bot token encryption for per-user notifications
- Hourly notification schedule per user (day + hour to receive reports)

## Technical Requirements

### Backend
- Express 5 REST API
- Mongoose (MongoDB) with async/await
- Firebase Admin SDK (Google sign-in verification)
- JWT auth (24h expiry via httpOnly cookie)
- node-cron (5-min usage collection + hourly reporting + Friday summary)
- AES-256-GCM encryption for sensitive data (access tokens, bot tokens)

### Frontend
- React 19 SPA with React Router v7
- Vite bundler with HMR
- Tailwind CSS v4 via @tailwindcss/vite
- shadcn/ui (Radix UI) component library

### Database
- MongoDB (via MONGO_URI env var)
- Collections: seats, users, schedules, alerts, usage_snapshots, seat_activity_logs, active_sessions
- Mongoose models with schema validation
- TTL indexes for automatic data cleanup (usage_snapshots: 90-day retention)

### Auth
- Google sign-in via Firebase client SDK
- JWT cookie issued on successful verification
- Admin role checks via middleware

## Non-Functional Requirements

- **Performance**: MongoDB with indexing; <100ms API response time
- **Reliability**: Mongoose connection pooling; graceful shutdown
- **Security**: CORS restricted, HTTPS recommended, JWT secret rotation
- **Availability**: Cron jobs tolerate timeouts
- **Scalability**: Designed for <100 users; MongoDB sufficient

## Success Criteria

1. All CRUD operations on seats, users, alerts functional
2. Activity tracking automated and heatmap visualized
3. Usage metrics collected every 5 minutes for active seats
4. Access tokens encrypted and stored securely
5. Usage snapshots queryable with pagination and filtering
6. Telegram notifications sent on schedule
7. Alerts triggered and resolved correctly
8. SPA navigation smooth, no page reloads
9. Auth gating enforced for admin endpoints
10. Zero data corruption with concurrent usage

## Acceptance Criteria

- All API endpoints tested and working
- Database migrations run without errors
- Telegram bot integration tested
- Admin role gating verified
- Error handling graceful (400/401/403/500 responses)
- Documentation complete and current
- Usage collection cron job running every 5 minutes
- Activity tracking detects hourly changes
- Token encryption/decryption working correctly
- Usage snapshots stored and queryable
- Frontend displays activity heatmap and metrics with status indicators

## Product Roadmap (Phase 1 Complete)

### Current State (Done)
- Seat CRUD + ownership model (soft-delete with restore capability)
- Seat profile cache with auto-refresh on token updates (6h staleness threshold)
- Seat preview API for credential validation + duplicate/restorable detection
- User management (create, update, delete, active status)
- Per-user alert settings (rate_limit_pct, extra_credit_pct) and watched_seat_ids subscriptions
- Auto-generated activity patterns (read-only heatmap, daily 04:00 regeneration)
- Real-time activity tracking: 5-min cron detects hourly usage deltas, populates SeatActivityLog
- Activity heatmap visualization (7x24 grid, activity_rate, avg/max delta, configurable week range)
- Realtime activity status endpoint (current hour indicator, snapshot staleness)
- Activity logs API with date range filtering and pagination
- Pattern regeneration endpoint (admin-only manual trigger)
- Real-time alert system (rate_limit, token_failure, usage_exceeded, session_waste, 7d_risk)
- Per-user per-seat alert deduplication with notification tracking (notified_at, read_by)
- Telegram weekly reports + per-user hourly reports
- SPA dashboard with fleet KPIs, per-seat overview, activity patterns
- Google sign-in + JWT auth
- Usage metrics collection (5-min cron)
- Anthropic API token management (encrypted AES-256-GCM)
- Personal Telegram bot integration (per-user encrypted tokens)
- Usage snapshots with 90-day TTL
- Vietnamese UI for seat restore flow (choice banner)
- **Teams Feature**: Create/edit/delete team groups (view-only seat grouping); team CRUD endpoints + UI; team members see grouped seats

### Potential Improvements (Phase 2)

1. **Advanced Analytics**
   - Usage trends (moving average, week-over-week)
   - Per-model breakdown tracking (Claude 3.5 Sonnet, Opus, Haiku)
   - Team-level reports

2. **Automation**
   - Auto-assignment of users to available seats
   - Predictive alerts (usage trend-based)
   - Automated usage data sync from Anthropic API

3. **UX Enhancements**
   - Dark mode toggle
   - Export to CSV/PDF
   - Bulk user upload
   - Mobile-responsive design polish

4. **Integration**
   - Slack notifications alongside Telegram
   - Google Sheets sync for reporting
   - Email reminders

5. **Admin Features**
   - Audit logs (who did what and when)
   - User activity tracking
   - Seat cost analysis
   - Scheduled reports (daily/weekly/monthly)

## Constraints & Dependencies

- **Firebase Project**: Must have active project + service account JSON
- **MongoDB**: Running instance accessible via MONGO_URI
- **Telegram Bot**: Requires token and chat ID setup
- **Encryption Key**: 32-byte (64 hex chars) for AES-256-GCM token encryption
- **Anthropic OAuth**: Access token from Anthropic dashboard for usage API
- **Environment**: Node.js 18+, pnpm package manager
- **Browser**: Modern ES6+ support (Chrome, Firefox, Safari, Edge)
- **Timezone**: All cron jobs use Asia/Ho_Chi_Minh (Asia/Saigon)

## Glossary

| Term | Definition |
|------|-----------|
| Seat | Claude Teams account with N slots |
| Slot | Single user access on a seat |
| Usage % | Percentage (0-100%) of seat usage within a time window (5h, 7d) |
| Activity Pattern | Auto-generated recurring 7x24 heatmap showing typical seat usage hours |
| SeatActivityLog | Hourly activity record (is_active, delta) updated every 5 minutes |
| Alert | Notification triggered by usage threshold, token failure, or activity anomaly |
| Team | Group classification (dev or mkt) for organizational tracking |

