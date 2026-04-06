# Dashboard Time Range Filter Impact Analysis

**Date:** 2026-04-06  
**Task:** Identify which dashboard components/metrics are affected by the time range filter vs. which display realtime/current data  
**Scope:** packages/web/src/pages/dashboard.tsx, component implementations, and API routes in packages/api/src/routes/dashboard.ts

---

## Executive Summary

The dashboard has **7 range-dependent components** and **4 range-independent components**.

- **Range-Dependent** = shows historical data that changes when you adjust the time range filter (day/week/month/3month/6month)
- **Range-Independent** = shows current/realtime snapshots or today-only data; unaffected by time range filter

---

## Endpoints Analysis

### API Endpoints that USE range parameter:

| Endpoint | Range Used For | Filter Target |
|----------|----------------|----------------|
| GET /api/dashboard/enhanced | Filter usageTrend | UsageSnapshot.fetched_at >= rangeStart |
| GET /api/dashboard/efficiency | Filter closed windows | UsageWindow.window_end >= rangeStart |
| GET /api/dashboard/peak-hours | Filter heatmap grid | UsageWindow.window_end >= rangeStart |

### API Endpoints that IGNORE range parameter:

| Endpoint | Data Source | Note |
|----------|-------------|------|
| GET /api/dashboard/summary | Latest UsageSnapshot via aggregation | Always returns latest (no time filtering) |
| GET /api/dashboard/usage/by-seat | Latest UsageSnapshot per seat | Always returns latest (no time filtering) |
| GET /api/dashboard/personal | Today's schedules + current user rank | Hardcoded to today; no range param |

---

## RANGE-DEPENDENT Components (show historical data)

### 1. DashboardTrendChart
- **Hook:** useDashboardEnhanced(range, filter.effective)
- **API:** /api/dashboard/enhanced
- **What Changes:** Usage trend points (7d & 5h average utilization over time)
- **Granularity:** Hourly (if range=day), daily (if range=week/month)

### 2. DashboardSeatUsageChart
- **Hook:** useDashboardEnhanced(range, filter.effective)
- **API:** /api/dashboard/enhanced
- **What Changes:** Latest per-seat usage percentages (5h, 7d, Sonnet, Opus)

### 3. DashboardDetailTable
- **Hook:** useDashboardEnhanced(range, filter.effective)
- **API:** /api/dashboard/enhanced
- **What Changes:** Full seat table with usage metrics and user occupancy

### 4. DashboardEfficiency
- **Hook:** useEfficiency(range, filter.effective)
- **API:** /api/dashboard/efficiency
- **What Changes:**
  - Summary metrics (avg utilization, peak max/min, tier counts, waste %)
  - Per-seat breakdown (avg utilization, delta 5h/7d)
  - Daily trend (avg utilization & sessions per day)
  - Sparkline (closed windows from selected period)
  - Active sessions (open windows in scope)
  - Leaderboards (top/bottom seats by efficiency)

### 5. DashboardSeatEfficiency
- **Hook:** useDashboardEnhanced(range, filter.effective)
- **API:** /api/dashboard/enhanced
- **What Changes:** Seat efficiency visualization (occupancy & usage by seat)

### 6. DashboardRealtime5h
- **Hook:** useEfficiency(range, filter.effective)
- **API:** /api/dashboard/efficiency
- **What Changes:** Recently closed cycles (sparkline filtered by range)
- **Note:** "Realtime" in name but closed cycles are range-filtered

### 7. DashboardPeakHoursHeatmap
- **Hook:** usePeakHours(range, filter.effective)
- **API:** /api/dashboard/peak-hours
- **What Changes:** 7x24 heatmap grid (intensity of each hour x day-of-week)
- **Formula:** Average & max utilization per hour across selected period

---

## RANGE-INDEPENDENT Components (realtime/current data only)

### 1. DashboardStatOverview (PARADOX COMPONENT)
- **Hook:** useDashboardEnhanced(range, filter.effective) <- receives range
- **API:** /api/dashboard/enhanced <- passes range param
- **What It Shows:** Total seats, active users, avg 5h%, avg 7d%, alerts, today's schedules
- **Why Not Affected:** 
  - Explicitly labeled "Không chịu ảnh hưởng bởi filter thời gian" (Not affected by time filter)
  - Shows latest snapshots, not historical aggregations
  - All displayed values come from current state (latest UsageSnapshot)
- **User Impact:** Adjusting range has zero visible effect on this card

### 2. DashboardPersonalContext
- **Hook:** usePersonalDashboard() <- NO range parameter
- **API:** /api/dashboard/personal <- NO range param
- **What It Shows:** My schedule for TODAY, my seats, my usage rank (all-time)
- **Why Not Affected:** Dedicated endpoint with hardcoded today; no range filtering
- **User Impact:** Non-affected card; range filter has zero effect

### 3. ForecastUrgentCard
- **Data Source:** data?.urgent_forecasts from useDashboardEnhanced()
- **What It Shows:** Top 3 seats with urgent forecast status (warning/critical/imminent)
- **Why Not Affected:** Forecast logic based on current usage state, not historical period
- **Admin-Only:** Yes

### 4. TokenFailurePanel
- **Data Source:** data?.token_failures from useDashboardEnhanced()
- **What It Shows:** Seats with token fetch errors (OAuth issues)
- **Why Not Affected:** Pulls from Seat.last_fetch_error (current field, not historical)
- **Admin-Only:** Yes

---

## Summary Table: Which Change With Range

| Component | Range Affected | API Hook | Endpoint |
|-----------|----------------|----------|----------|
| DashboardTrendChart | YES | useDashboardEnhanced | /enhanced |
| DashboardSeatUsageChart | YES | useDashboardEnhanced | /enhanced |
| DashboardDetailTable | YES | useDashboardEnhanced | /enhanced |
| DashboardEfficiency | YES | useEfficiency | /efficiency |
| DashboardSeatEfficiency | YES | useDashboardEnhanced | /enhanced |
| DashboardRealtime5h | YES | useEfficiency | /efficiency |
| DashboardPeakHoursHeatmap | YES | usePeakHours | /peak-hours |
| DashboardStatOverview | NO | useDashboardEnhanced | /enhanced |
| DashboardPersonalContext | NO | usePersonalDashboard | /personal |
| ForecastUrgentCard | NO | (from enhanced data) | /enhanced |
| TokenFailurePanel | NO | (from enhanced data) | /enhanced |

---

## Key Technical Insight

The range filter is implemented at the API level, not the hook level:

1. Frontend passes range to hook
2. Hook adds ?range=X to API query
3. API computes rangeStart and filters queries:
   ```
   windowMatch = { window_end: { $gte: rangeStart }, is_closed: true }
   ```
4. Components that query /efficiency or /peak-hours see filtered results
5. Components that only need latest snapshots (like DashboardStatOverview) ignore the historical filtering

---

## Unresolved Questions

- Is DashboardStatOverview's "range-independent" behavior intentional or a bug?
  - Should current stats be affected by range filter?
  
- Should DashboardPersonalContext show range-filtered personal stats?
  - E.g., "my efficiency in selected period" instead of all-time rank?
  
- Are there plans to show historical urgency forecasts?

