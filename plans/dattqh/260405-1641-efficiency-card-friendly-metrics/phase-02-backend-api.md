# Phase 2 — Backend API (extend /efficiency response)

## Overview
**Priority:** High · **Status:** pending
Mở rộng endpoint `GET /api/dashboard/efficiency` với `quota_forecast`, xoá/deprecate fields legacy.

## Related files
- **Modify:** `packages/api/src/routes/dashboard.ts` (lines ~274-421)
- **Read:** `packages/api/src/services/quota-forecast-service.ts` (Phase 1)

## Changes

### Add to response
```ts
quota_forecast: {
  seven_day: QuotaForecastResult | null   // from Phase 1
  five_hour: {
    current_pct: number                    // MAX delta_5h across active sessions
    status: "safe" | "warning" | "critical"  // <50/50-80/>80
  } | null
}
```

### Compute 5h status
- Query `usage_windows` với `is_closed: false` (active sessions)
- `max_five_hour = max(utilization_pct)` across active
- Nếu no active → `five_hour: null`

### Drop legacy fields (after grep confirm unused)
- `avg_impact_ratio`
- `avg_delta_7d_sonnet`, `avg_delta_7d_opus` (keep `avg_delta_7d` tổng if still useful, else drop)
- `perSeat.avg_delta_7d_sonnet`, `.avg_delta_7d_opus`, `.avg_impact_ratio`

### Preservation
- Giữ `avg_utilization`, `total_sessions`, `waste_sessions`, `total_hours`
- Giữ `activeSessions`, `perUser`, `perSeat` (label only, drop split fields)

## Todo
- [ ] Grep `avg_impact_ratio|avg_delta_7d_sonnet|avg_delta_7d_opus` toàn repo
- [ ] Confirm các caller (alerts, notifications) không dùng → safe to drop
- [ ] Import `computeQuotaForecast` từ Phase 1 service
- [ ] Call forecast after existing aggregation, pass `effectiveIds` hoặc all seat IDs in scope
- [ ] Add `quota_forecast` vào `res.json(...)`
- [ ] Compute `five_hour` từ active windows
- [ ] Remove deprecated fields from aggregation pipelines + empty fallback

## Success criteria
- Endpoint trả đúng shape mới
- Typecheck pass (`pnpm -F @repo/api build`)
- Manual smoke test: `curl` endpoint returns `quota_forecast`
- Không break alert-service, dashboard-stat-overview, dashboard-my-efficiency

## Risks
- Forecast query adds N+1 DB hits (per-seat query) → batch qua `$in` nếu possible, hoặc cache 5 phút
- Callers khác có thể dùng `avg_delta_7d_sonnet` → phải grep kỹ trước khi xoá
