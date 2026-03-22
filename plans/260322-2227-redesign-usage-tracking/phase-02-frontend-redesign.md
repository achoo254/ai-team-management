---
phase: 2
priority: high
status: pending
effort: medium
depends_on: [1]
---

# Phase 2: Frontend Redesign

## Overview
Redesign log form and dashboard to work with weekly percentage data.

## Files to Modify

### 1. `public/views/view-log-usage.html`
Replace entire form + table:

**Form fields:**
- Week (auto-detect current week Monday, allow select previous weeks)
- All models % (input number 0-100)
- Sonnet only % (input number 0-100)
- Submit button

**History table columns:**
- Tuần (week_start)
- All Models %
- Sonnet %
- Ngày log (logged_at)

### 2. `public/views/view-dashboard.html`
Replace stat cards (4 → 3):
- Card 1: "Avg All Models" — avgAllPct with progress bar
- Card 2: "Avg Sonnet" — avgSonnetPct with progress bar
- Card 3: "Cảnh báo active" — activeAlerts count

Replace usage by seat table columns:
- Seat email
- Team badge
- Users
- All Models % (with color: green <50, yellow 50-80, red >80)
- Sonnet % (with color)
- Last Logged

### 3. `public/js/dashboard-app.js`
Update state:
```js
logForm: { weekStart: getCurrentWeekStart(), weeklyAllPct: 0, weeklySonnetPct: 0 },
```
Update `submitLog()` to send new fields.
Update `loadDashboard()` to use new summary response.

### 4. `public/js/dashboard-helpers.js`
- Update `seatStatus()` — based on weekly_all_pct instead of total_sessions
- Add `usagePctClass(pct)` — returns color class based on percentage
- Remove session-based helpers

### 5. `public/js/dashboard-admin-actions.js`
- Remove CSV import UI references if any

## Success Criteria
- [ ] Log form shows week + 2 percentage fields
- [ ] History table shows weekly data
- [ ] Dashboard cards show % averages
- [ ] Seat table shows weekly percentages with color coding
- [ ] No references to sessions/tokens/purpose/project remain
