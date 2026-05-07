# Project Changelog

All notable changes to the Claude Teams Management Dashboard project are documented here.

**Format**: Major features, breaking changes, and significant bug fixes are listed chronologically. Minor updates and refactoring are grouped by release cycle.

---

## [2026-05-07] Remove Seat Capacity Limit (`max_users`)

### Breaking Changes

**Removed `max_users` field — seats now allow unlimited members**

- **Seat model** (`packages/api/src/models/seat.ts`): field `max_users` xoá khỏi schema + interface
- **API routes**:
  - `POST /api/seats` no longer accepts/validates `max_users` in request body
  - `PUT /api/seats/:id` no longer accepts `max_users` (removed from allowed PATCH fields)
  - `POST /api/seats/:id/assign` no longer enforces capacity check — assignment always succeeds
- **Dashboard response** (`GET /api/dashboard/enhanced`): removed `fullSeatCount` and per-seat `max_users` fields
- **Shared DTO** (`packages/shared/types.ts`): `Seat.max_users` removed
- **Frontend**:
  - `SeatFormDialog`: removed "Số user tối đa" inputs (create + edit)
  - `SeatCard`: badge changed from `X/Y members` → `X members` with users icon
  - `DashboardStatOverview`: replaced `totalCapacity`/`fullSeatCount` with `totalMembers`
  - `DashboardDetailTable`: occupancy badge replaced with sortable plain count
  - `DashboardSeatUsageChart`: tooltip "Thành viên: X" (no `/Y`)

### DB Migration

No active migration required — Mongoose schema removal causes existing `max_users` field to be ignored on read. Optional cleanup:
```js
db.seats.updateMany({}, { $unset: { max_users: "" } })
```

### Rationale

Seat capacity limit no longer reflects business need. Owners requested unlimited member assignment per seat.

---

## [2026-04-06] Predictive Alert System (Fast Burn + Quota Forecast)

### Major Changes

**New Alert Types: Predictive Monitoring**
- **fast_burn** — Detects high-velocity usage in 5h window combined with short ETA to limit
  - Trigger: `velocity >= burn_rate_threshold (%/h) AND eta_hours <= eta_warning_hours`
  - Example: 25%/h velocity + 1h ETA on 85% → alert fires
  - User configurable via `watched_seats[].burn_rate_threshold` (default 15 %/h) and `eta_warning_hours` (default 1.5h)
- **quota_forecast** — Linear regression projects 7-day quota usage against user threshold
  - Trigger: 7-day slope projects hit user's threshold within `forecast_warning_hours` (default 48h)
  - Metadata includes: current 7d%, slope/hour, hours to user threshold, hours to reset
  - Example: 60% at 2%/h slope → will hit 85% in ~12.5h → alert (if < 48h)

**IWatchedSeat Schema Extended** (User model)
```typescript
watched_seats: [{
  seat_id: ObjectId,
  threshold_5h_pct: Number (default: 90),
  threshold_7d_pct: Number (default: 85),
  burn_rate_threshold: Number | null (default: 15 %/h, null = disabled),
  eta_warning_hours: Number | null (default: 1.5h, null = disabled),
  forecast_warning_hours: Number | null (default: 48h, null = disabled)
}]
```

**New Services**
- `predictive-alert-service.ts` — Extracted logic for fast_burn + quota_forecast checks
- `quota-forecast-service.ts` — Linear regression forecasting on 7-day usage snapshots

**Alert Model Changes**
- Added `fast_burn`, `quota_forecast` to `AlertTypeDb` enum
- Alert metadata now includes predictive fields: `velocity`, `eta_hours`, `slope_per_hour`, `hours_to_threshold`, `hours_to_reset`

**API Routes: Watched Seats Management**
- `GET /api/user/watched-seats` — List user's watched seats + thresholds
- `POST /api/user/watched-seats` — Add seat to watch with thresholds
- `PUT /api/user/watched-seats/:seatId` — Update thresholds for watched seat (supports partial updates)
- `DELETE /api/user/watched-seats/:seatId` — Unwatch seat
- Validation: burn_rate_threshold ≥ 5 %/h, eta_warning_hours ≥ 0.5h, forecast_warning_hours ≥ 6h (null allowed)

**Frontend: Alert Configuration UI**
- `watch-threshold-dialog.tsx` — New collapsible "Predictive Thresholds" section in watch seat dialog
  - Inputs for burn_rate_threshold, eta_warning_hours, forecast_warning_hours
  - Tooltip explanations of each threshold
  - Disable toggle for each predictive alert type (null = disabled)
- `watched-seats-summary.tsx` — Displays all watched seats with current thresholds
- `watch-seat-button.tsx` — Updated to pass predictive fields when adding/editing watch

**Integration: Alert Generation Cron**
- `checkSnapshotAlerts()` now calls `checkFastBurnAlerts()` and `checkQuotaForecastAlerts()` in parallel
- Predictive checks run on same 5-min cadence as snapshot alerts
- Deduplication per (user_id, seat_id, type, window) prevents duplicate notifications

**Tests**
- 16 new unit tests in `tests/api/predictive-alert-service.test.ts`:
  - fast_burn trigger logic (velocity + ETA combinations)
  - quota_forecast regression & threshold projection
  - Deduplication of predictive alerts
  - Edge cases: clock drift, stale snapshots, disabled thresholds

**Backward Compatibility**
- Existing watched_seats entries auto-populated with default thresholds on first check
- Predictive alerts disabled (null thresholds) unless explicitly configured by user
- Alert feed unchanged; new types coexist with legacy rate_limit, token_failure, etc.

### Files Changed
- `packages/api/src/models/alert.ts` — Added 'fast_burn', 'quota_forecast' to enum
- `packages/api/src/models/user.ts` — Extended IWatchedSeat with 3 new fields
- `packages/shared/types.ts` — Updated AlertType + AlertMetadata with predictive fields, added WatchedSeat DTO
- `packages/api/src/services/alert-service.ts` — Integrated predictive checks, dedup logic
- `packages/api/src/services/predictive-alert-service.ts` (NEW) — fast_burn + quota_forecast logic
- `packages/api/src/services/quota-forecast-service.ts` (NEW) — Linear regression forecasting
- `packages/api/src/routes/watched-seats.ts` (NEW) — Watched seats API endpoints
- `packages/web/src/hooks/use-watched-seats.ts` (NEW) — React Query hook for watched seats CRUD
- `packages/web/src/components/watch-threshold-dialog.tsx` — Added predictive config section
- `packages/web/src/components/watched-seats-summary.tsx` — Display watched seats + thresholds
- `packages/web/src/components/watch-seat-button.tsx` — Pass predictive fields in form
- `tests/api/predictive-alert-service.test.ts` (NEW) — 16 unit tests for predictive logic

---

## [2026-04-06] Auto Seat Activity Schedule (Heatmap-Based Pattern Generation)

### Major Changes

**Schedule Module Refactored: Manual Assignment → Auto-Detected Patterns**
- Removed user-assignment model: no more `user_id`, `usage_budget_pct` fields from Schedule
- Added `source` field: enum `'auto' | 'legacy'` to distinguish generated vs. legacy entries
- Removed CRUD endpoints: No more POST/PUT/PATCH/DELETE on schedules
- Added read-only pattern queries: GET `/schedules`, `/schedules/today`, `/schedules/heatmap/:seatId`
- Migration: Existing schedule entries marked as `source='legacy'`, deprecated fields removed

**New SeatActivityLog Collection (Hourly Activity Tracking)**
- Stores hourly activity data per seat (one record per seat/date/hour)
- Fields: is_active (bool), delta_5h_pct (usage %), snapshot_count (metrics count)
- Populated by 5-min cron via `detectSeatActivity()` service (analyzes usage snapshot deltas)
- Unique index: (seat_id, date, hour) — prevents duplicates
- Used as source for daily pattern generation

**New Activity Pattern Generation (Daily 04:00 Asia/Saigon)**
- Cron job via `generateAllPatterns()` analyzes 2-4 weeks of SeatActivityLog
- Detects recurring weekly patterns per seat (7x24 grid, day_of_week x start_hour)
- Generates Schedule entries with `source='auto'` (replaces previous auto entries)
- Exports stats: patterns_generated, anomalies_detected
- Called via `POST /api/schedules/regenerate` endpoint (admin-only manual trigger)

**New Activity Pattern Services**
- `seat-activity-detector.ts` — Detects hourly activity from usage snapshot deltas
- `activity-pattern-service.ts` — Analyzes historical activity, generates weekly patterns
- `activity-anomaly-service.ts` — Identifies unusual activity spikes for anomaly alerts

**New Schedule API Endpoints**
- `GET /api/schedules` — List auto-generated patterns (read-only), ?seatId= filter
- `GET /api/schedules/today` — Today's patterns for visible seats (read-only)
- `GET /api/schedules/heatmap/:seatId` — Aggregated heatmap for N weeks (activity_rate, avg_delta per day/hour)
- `GET /api/schedules/activity-logs` — Raw hourly logs with date range filters, pagination
- `GET /api/schedules/realtime` — Current hour activity status per seat (is_active, current_delta, last_snapshot_at)
- `POST /api/schedules/regenerate` — Force regenerate all patterns (admin only)

**Alert Model Simplified**
- Removed: `extra_credit` alert type (no longer used)
- Updated: `user_id` field now part of primary dedup key (user_id, seat_id, type, window)
- Added: `window` field for rate_limit alerts (values: '5h', '7d', null)
- Added: `notified_at` field to prevent duplicate notifications for same condition
- Added: `read_by` array to track which users marked alert as read

**Rationale**
- Manual assignment had low adoption; auto-detection from usage is more accurate & automated
- Heatmap visualization clearer than manual time slot grid
- Removes CRUD complexity while keeping insights accessible
- Enables anomaly detection on unusual activity patterns (future enhancement)

### Performance Impact
- SeatActivityLog (one per 5-min interval per seat) adds minimal overhead
- Pattern generation runs once daily (04:00) on historical data; no impact on request path
- Heatmap aggregation query optimized with indexes on (seat_id, date, hour)
- New realtime endpoint hits UsageSnapshot (already indexed)

---

## [2026-04-05] Remove Teams Model + Dashboard Enrichment

### Major Changes

**Teams Model Removed (Complete Elimination)**
- Deleted teams collection, model, routes, middleware, types
- Cleaned 17 files removing all team references

**Rationale:**
- Teams were organizational grouping only, no core logic dependency
- < 5 seats per user → YAGNI (You Aren't Gonna Need It)
- Simplified data model: User.seat_ids (assigned) + Seat.owner_id (ownership) sufficient
- Freed up dashboard slot for richer per-seat insights

**Dashboard API Enrichment**

Extended `/api/dashboard/enhanced` response:
1. **tokenIssueCount** — seats with inactive tokens or fetch errors (computed, no extra query)
2. **fullSeatCount** — seats at capacity (user_count >= max_users)
3. **owner_name** per seat in usagePerSeat — single batch User query by owner_ids

New `/api/dashboard/personal` endpoint (auth required):
- `mySchedulesToday` — user's scheduled slots with seat labels + budget
- `mySeats` — owned + assigned seats with role badge
- `myUsageRank` — user's position in system (rank, total, avg delta 5h)

**Breaking Changes**:
- Teams CRUD removed entirely
- Dashboard response shape changed (removed teamUsage, added tokenIssueCount, fullSeatCount)
- Team-related UI components removed

### Testing
- Tests: ✓ 24/24 passing (team-related tests removed/updated)
- Manual: Dashboard renders with new badges, /personal endpoint returns correct data

---

## [2026-04-04] System Foundation (Alert Redesign, User Settings, Notifications)

### Summary
Series of foundational changes consolidating alert system: moved from global settings to per-user configuration, implemented personal Telegram bot support, per-user notification schedules, self-service seat management, schedule-based activity tracking, and usage snapshot consolidation.

### Key Changes (Summarized)
- **Alert Settings**: Moved from global `settings` collection to per-user `alert_settings` in User model
- **Telegram**: Dual-bot support — system bot (weekly reports) + personal bots (per-user alerts)
- **Notification Schedule**: Per-user configurable report timing (day + hour)
- **Self-Service Seats**: Users can create/manage seats; ownership auto-assigned
- **Schedules**: Hourly time slots tied to activity patterns; per-user budget alerts during scheduled slots
- **Usage Consolidation**: Removed WeeklyUsageLog; snapshot-based real-time metrics via Anthropic API
- **Alert System**: Snapshot-based evaluation (rate_limit, token_failure) vs legacy high_usage/no_activity

### Files Impacted
- Models: User (added alert_settings), Seat (owner_id auto-assign), Schedule (added slot+user_id)
- Routes: settings → user-settings, admin operations simplified
- Services: alert-service.ts (checkSnapshotAlerts), telegram-service.ts (dual-bot), token-refresh cron
- Frontend: Pages (alerts, admin) redesigned, hooks simplified
- Tests: Full coverage added for alert dedup, schedule logic, notifications

### Breaking Changes
1. Alert notification routing changed — personal bots required for alerts (system bot no longer sends)
2. Alert thresholds now per-user — admin no longer sets global thresholds
3. /api/settings route removed — replaced with /api/user/settings

### Backward Compatibility
- Existing alert documents remain queryable
- Existing usage snapshots unaffected
- Cron schedule unchanged (still 5-minute cycle)
- Non-enabled users (default) receive no alerts (opt-in required)

---

## Future Enhancements

- [ ] Alert resolution audit log (who resolved, when, reason)
- [ ] Configurable alert quiet periods (snooze)
- [ ] Multi-threshold rules (AND/OR logic for rate limits)
- [ ] Alert severity levels (critical, warning, info)
- [ ] Webhook notifications (Slack, Discord)
- [ ] Alert templates customizable by admin
- [ ] Predictive alert fine-tuning (ML model for burn rate detection)
- [ ] Alert correlation (group related alerts by seat/user)

---

## [TEMPLATE] Release Version

### New Features
- Feature description with impact

### Bug Fixes
- Bug description with root cause

### Breaking Changes
- Change description with migration path

### Deprecated
- Component/function being removed with replacement

### Performance
- Improvement description with benchmarks if applicable

### Documentation
- Docs updated or created

---

*Last updated: 2026-04-06*
