---
phase: 1
priority: high
status: pending
effort: medium
---

# Phase 1: DB + Backend Redesign

## Overview
Redesign usage_logs table and all backend services/routes to work with weekly percentage data instead of daily session counts.

## Files to Modify

### 1. `server/db/migrations.js`
Replace usage_logs table:
```sql
CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seat_email TEXT NOT NULL,
  week_start TEXT NOT NULL,
  weekly_all_pct INTEGER DEFAULT 0,
  weekly_sonnet_pct INTEGER DEFAULT 0,
  user_id INTEGER,
  logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seat_email, week_start, user_id)
);
CREATE INDEX IF NOT EXISTS idx_usage_logs_seat_week ON usage_logs(seat_email, week_start);
```
Remove old index `idx_usage_logs_seat_date`.

Update alerts CHECK constraint — remove `session_spike`, `limit_warning`. Keep `high_usage`, `no_activity`.

### 2. `server/config.js`
Replace alert thresholds:
```js
alerts: {
  highUsagePct: 80,       // weekly_all_pct threshold
  inactivityWeeks: 1,     // weeks without log
},
telegram: {
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.TELEGRAM_CHAT_ID || '',
  topicId: process.env.TELEGRAM_TOPIC_ID || '',
},
```
Remove: `highDailyCostCents`, `weeklyPaceCostCents`, `sessionSpikeCount`, `inactivityDays`, `syncCron`, `anthropic*` fields.

### 3. `server/services/usage-sync-service.js`
Rewrite `logUsage()`:
```js
function logUsage({ seatEmail, userId, weekStart, weeklyAllPct, weeklySonnetPct }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO usage_logs (seat_email, week_start, weekly_all_pct, weekly_sonnet_pct, user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(seatEmail, weekStart, weeklyAllPct, weeklySonnetPct, userId);
  return { success: true, weekStart, seatEmail };
}
```
Remove `importCsv()` entirely.

### 4. `server/services/alert-service.js`
Rewrite `checkAlerts()`:
- Rule 1: `high_usage` — latest log for any seat has weekly_all_pct >= 80
- Rule 2: `no_activity` — seat has no log in last 1 week but has been used before
Remove: session_spike, limit_warning rules.

### 5. `server/routes/usage-log-routes.js`
- POST `/api/usage-log` — accept `{ weekStart, weeklyAllPct, weeklySonnetPct }`
- GET `/api/usage-log/mine` — return logs ordered by week_start DESC LIMIT 20

### 6. `server/routes/dashboard-routes.js`
- GET `/api/dashboard/summary` — return `{ avgAllPct, avgSonnetPct, activeAlerts, totalLogs }`
- GET `/api/dashboard/usage/by-seat` — aggregate by seat: latest weekly_all_pct, weekly_sonnet_pct, last logged week
- Remove GET `/api/dashboard/usage` (date range query — no longer needed)

### 7. `server/routes/admin-routes.js`
- Remove `POST /api/admin/import-csv` endpoint
- Remove `importCsv` import

### 8. `.env.example`
Add:
```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_TOPIC_ID=
```

## Helper: Week Start Calculation
```js
function getCurrentWeekStart() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}
```

## Success Criteria
- [ ] usage_logs table has new schema
- [ ] POST /api/usage-log accepts weeklyAllPct + weeklySonnetPct
- [ ] Dashboard summary returns % averages
- [ ] Alert service checks % thresholds
- [ ] CSV import removed
- [ ] Server starts without errors
