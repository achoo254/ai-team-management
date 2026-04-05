# quan-ly-team-claude: Project Overview & PDR

## Purpose

Internal dashboard for managing Claude Teams accounts. Centralizes seat allocation, usage tracking, scheduling, alerting, and notifications.

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

### 2. Scheduling (Hourly)
- Define hourly time slots (start_hour to end_hour per day)
- Assign users to day-of-week + hour range (e.g., Mon 8-12, Wed 14-18)
- Prevent double-booking on same seat
- Budget allocation per schedule (% of seat's usage budget)

### 3. Alerts (Real-time)
- **Rate Limit**: Trigger when seat usage exceeds configurable threshold (default 80%) across 5h, 7d, 7d_sonnet, 7d_opus windows
- **Extra Credit**: Trigger when extra credit utilization exceeds threshold (default 80%)
- **Token Failure**: Trigger for seats with active tokens but failed API fetch
- Alert resolution with audit trail (who, when, timestamp)
- Alert history and deduplication

### 4. Telegram Notifications
- **Weekly Report** (Friday 17:00 Asia/Saigon): Usage summary from snapshots, alerts, inactive users
- Integration via Telegram bot + topic

### 5. User & Team Management
- Create/update users (name, email, role, team)
- Manage teams (dev/mkt): name, label, color
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
- Vanilla JS SPA
- Dynamic HTML partial loading
- No framework/bundler
- CSS (Tailwind or custom)

### Database
- MongoDB (via MONGO_URI env var)
- Collections: seats, users, schedules, alerts, settings, teams, usage_snapshots
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

1. All CRUD operations on seats, users, schedules, alerts functional
2. Weekly usage logging & retrieval working
3. Usage metrics collected every 30 minutes for active seats
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
- Usage collection cron job running every 30 minutes
- Token encryption/decryption working correctly
- Usage snapshots stored and queryable
- Frontend displays latest metrics with status indicators

## Product Roadmap (Phase 1 Complete)

### Current State (Done)
- Seat CRUD + team assignment + ownership model
- Seat soft-delete with restore capability (restore_seat_id, force_new)
- Seat profile cache (account_name, org_name, rate_limit_tier, subscription_status)
- Profile auto-refresh on token updates + manual refresh endpoint (6h staleness)
- Seat preview API (POST /preview-token) for credential validation + duplicate detection
- User management (create, update, delete, active status)
- Per-user alert settings and subscriptions (watched_seat_ids)
- Schedule CRUD with conflict prevention (hourly time slots + budget allocation)
- Real-time alert system (rate_limit, extra_credit, token_failure, usage_exceeded, session_waste, 7d_risk)
- Per-user alert thresholds (rate_limit_pct, extra_credit_pct)
- Telegram weekly reports + per-user hourly reports
- SPA dashboard with all views
- Google sign-in + JWT auth
- Usage metrics collection (5-min cron)
- Anthropic API token management (encrypted AES-256-GCM)
- Personal Telegram bot integration (per-user encrypted tokens)
- Usage snapshots with 90-day TTL
- Real-time usage metrics dashboard
- Active session tracking for budget alerts
- Vietnamese UI for seat restore flow (choice banner)

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
| Usage % | Weekly percentage (0-100%) of seat usage by user |
| Schedule | Time-based (day + morning/afternoon) assignment of user to seat |
| Alert | Notification triggered by usage threshold or inactivity |
| Team | Group classification (dev or mkt) for organizational tracking |

