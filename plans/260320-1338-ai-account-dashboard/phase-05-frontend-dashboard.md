# Phase 5: Frontend Dashboard

**Priority:** High | **Status:** pending | **Effort:** 1.5 days

## Overview
Single-page dashboard với TailwindCSS + Alpine.js. Không cần build step.

## Tech
- **TailwindCSS** via CDN — styling
- **Alpine.js** via CDN — reactivity, state management
- **Chart.js** via CDN — usage charts
- **No build step** — direct HTML/JS files served by Express

## Pages / Views

### 1. Login (`login.html`)
- Email + password form
- Redirect to dashboard on success

### 2. Dashboard (`index.html` — default view)
**Summary Cards:**
- Total sessions hôm nay
- Total tokens tuần này
- Estimated cost tháng này
- Active alerts count

**Usage Chart:**
- Line chart: daily tokens (7/30 days toggle)
- Bar chart: usage by seat
- Stacked bar: input vs output tokens per seat

**Recent Activity Table:**
- Date | Seat | Sessions | Tokens | Cost | Commits
- Filter by seat, date range
- Sort by any column

### 3. Seats View
- Card layout: mỗi seat 1 card
- Show: email, team, assigned users, current schedule
- Admin: drag-drop assign users, edit max_users

### 4. Schedule View
- Weekly calendar grid
- Rows = seats (3-person only), Columns = days
- Cells = Morning/Afternoon slots with assigned user
- Admin: click to change assignment
- Color-coded by user

### 5. Alerts View
- List active alerts with severity
- Admin: resolve button
- History tab for resolved alerts

### 6. Admin Panel (admin only)
- User management: CRUD users
- Manual sync button
- Export usage report (CSV)
- System settings

## Implementation Steps
- [ ] Create `public/login.html` — login form
- [ ] Create `public/index.html` — main SPA shell with navigation
- [ ] Create `public/js/api-client.js` — fetch wrapper with auth
- [ ] Create `public/js/dashboard.js` — summary cards + charts
- [ ] Create `public/js/seats.js` — seat management UI
- [ ] Create `public/js/schedule.js` — weekly calendar grid
- [ ] Create `public/js/alerts.js` — alert list + resolve
- [ ] Create `public/js/admin.js` — user CRUD + sync + export
- [ ] Responsive layout (mobile-friendly for quick checks)

## UI Design Principles
- Clean, minimal, data-focused
- Vietnamese labels cho UI elements
- Color scheme: blue (Dev) / green (MKT) team distinction
- Dark/light mode toggle (TailwindCSS)

## Success Criteria
- Dashboard loads fast (<1s)
- Charts render correctly with real data
- Schedule view shows correct slot assignments
- Mobile responsive
- Admin features hidden from user role
