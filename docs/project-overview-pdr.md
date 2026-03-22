# quan-ly-team-claude: Project Overview & PDR

## Purpose

Internal dashboard for managing 5 Claude Teams seats shared among 13 people (7 Dev + 6 MKT) at inet.vn. Centralizes seat allocation, usage tracking, scheduling, alerting, and notifications.

## Target Users

- **Admins**: Allocate seats, manage users, configure alerts, view reports
- **Developers & Marketers**: Log weekly usage, view schedules, check seat availability
- **Team Lead**: Monitor usage patterns, receive alerts on high usage/inactivity

## Key Features

### 1. Seat Management
- Create/update/delete Claude Teams seats
- Assign seats to dev or mkt team
- Track seat capacity (max users per seat)
- View seat status and current users

### 2. Usage Logging (Weekly %)
- Users log their weekly usage percentage (all models + specific model breakdowns)
- Store per-user usage data: seat, week_start, all_pct, sonnet_pct
- Week range: Monday 00:00 - Sunday 23:59 Asia/Saigon

### 3. Scheduling (Morning/Afternoon)
- Define morning (8:00-12:00) and afternoon (13:00-17:00) slots
- Assign users to day-of-week + slot (e.g., Mon-Fri morning, Wed afternoon)
- Prevent double-booking on same seat
- Default round-robin schedules for 3-person seats

### 4. Alerts
- **High Usage**: Trigger when seat usage > 80%
- **Inactivity**: Trigger when user hasn't logged for 1+ week
- Alert resolution/marking as read
- Alert history

### 5. Telegram Notifications
- **Weekly Report** (Friday 17:00 Asia/Saigon): Usage summary, alerts, inactive users
- **Log Reminder** (Friday 15:00 Asia/Saigon): Remind users to log past week usage
- Integration via Telegram bot + topic

### 6. User & Team Management
- Create/update users (name, email, role, team)
- Manage teams (dev/mkt): name, label, color
- Admin role gating for sensitive operations

## Technical Requirements

### Backend
- Express 5 REST API
- Mongoose (MongoDB) with async/await
- Firebase Admin SDK (Google sign-in verification)
- JWT auth (24h expiry via httpOnly cookie)
- node-cron (Friday reminders)

### Frontend
- Vanilla JS SPA
- Dynamic HTML partial loading
- No framework/bundler
- CSS (Tailwind or custom)

### Database
- MongoDB (via MONGO_URI env var)
- Collections: seats, users, usage_logs, schedules, alerts, teams
- Mongoose models with schema validation

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
3. Telegram notifications sent on schedule
4. Alerts triggered and resolved correctly
5. SPA navigation smooth, no page reloads
6. Auth gating enforced for admin endpoints
7. Zero data corruption with concurrent usage

## Acceptance Criteria

- All API endpoints tested and working
- Database migrations run without errors
- Telegram bot integration tested
- Admin role gating verified
- Error handling graceful (400/401/403/500 responses)
- Documentation complete and current

## Product Roadmap (Phase 1 Complete)

### Current State (Done)
- Seat CRUD + team assignment
- User management (create, update, delete, active status)
- Weekly usage logging per user per week
- Schedule CRUD with conflict prevention
- Alert creation/resolution
- Telegram weekly reports & reminders
- SPA dashboard with all views
- Google sign-in + JWT auth

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

