# Phase 2 — BLD View Page

## Context Links
- Plan: [../plan.md](../plan.md)
- Phase 1: [phase-01-data-quality-fixes.md](phase-01-data-quality-fixes.md)
- Brainstorm: `plans/dattqh/reports/brainstorm-260405-2109-enterprise-bld-dashboard.md`

## Overview
- Priority: HIGH
- Status: pending (blocked by P1)
- Effort: ~2-3 days

Executive-layer view at `/bld` route (admin-only). 4 KPI cards + rebalance actions + W/W comparison.

## Key Insights
- BLD chỉ cần **1-2 số** để quyết định, không phải 7 biểu đồ
- Billable filter: **chỉ @inet.vn**, bỏ @gmail.com (per user instruction)
- Cost: $125/seat/month (company pays monthly)
- **Gói Teams min 5 seats — KHÔNG cắt seat**. Optimize = rebalance member
- Narrative: "Waste $X/month → rebalance member Y sang seat Z để nâng utilization"
- Đề xuất **+1 seat** chỉ khi ≥2 seats ở critical/warning band ≥3 ngày liên tiếp

## Requirements

### Functional
1. Route `/bld` admin-only, redirect non-admin
2. **Scope filter: LOẠI seats có email thuộc personal domains** (config env)
3. 4 KPI cards: Fleet Util %, Waste $, W/W Δ, Forecast ETA (worst seat)
4. Per-user efficiency leaderboard (company users only)
5. Rebalance suggestions panel (rule-based, company seats only)
6. W/W comparison chart (8 weeks history, company seats only)

### Non-functional
- Page load <2s
- Metrics cached 5min (refetch on manual trigger)
- Billable filter deterministic via email domain

## Architecture

```
/bld page (admin-only route)
  ├─ <BldFleetKpiCards />       4 big number cards
  ├─ <BldWwComparisonChart />   8-week area chart
  ├─ <BldUserEfficiencyPanel /> leaderboard billable users
  └─ <BldActionsPanel />        rebalance suggestions

packages/api/src/routes/bld-metrics.ts (new)
  ├─ GET /api/bld/fleet-kpis
  ├─ GET /api/bld/user-efficiency
  └─ GET /api/bld/rebalance-suggestions

packages/api/src/services/bld-metrics-service.ts (new)
  └─ Compute all KPIs, filter billable (@inet.vn)
```

## Related Code Files

### Modify
- `packages/web/src/app.tsx` — add `/bld` route
- `packages/web/src/components/ui/sidebar.tsx` — add nav link (admin-only)
- `packages/api/src/index.ts` — mount bld-metrics router
- `packages/shared/types.ts` — BLD DTOs

### Create
**Backend:**
- `packages/api/src/routes/bld-metrics.ts`
- `packages/api/src/services/bld-metrics-service.ts`
- `tests/api/bld-metrics.test.ts`

**Frontend:**
- `packages/web/src/pages/bld.tsx`
- `packages/web/src/components/bld-fleet-kpi-cards.tsx`
- `packages/web/src/components/bld-ww-comparison-chart.tsx`
- `packages/web/src/components/bld-user-efficiency-panel.tsx`
- `packages/web/src/components/bld-actions-panel.tsx`
- `packages/web/src/hooks/use-bld-metrics.ts`

## Implementation Steps

### Backend

1. **Service: `bld-metrics-service.ts`**
   ```ts
   // Seat pricing (config via env, Claude giá có thể đổi)
   const MONTHLY_COST_USD = Number(process.env.SEAT_MONTHLY_COST_USD ?? 125)

   // Personal email domains (loại khỏi BLD analytics). Config via env:
   //   PERSONAL_EMAIL_DOMAINS=gmail.com,yahoo.com,outlook.com,hotmail.com,icloud.com
   // Default covers common providers. Project public-safe: no company name hardcoded.
   const DEFAULT_PERSONAL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'protonmail.com']
   const personalDomains = (process.env.PERSONAL_EMAIL_DOMAINS?.split(',') ?? DEFAULT_PERSONAL_DOMAINS)
     .map(d => d.trim().toLowerCase().replace(/^@/, ''))
     .filter(Boolean)

   // GLOBAL filter: exclude seats with personal emails
   // Áp dụng ở MỌI endpoint/metric của BLD
   function isCompanySeat(seat): boolean {
     const email = seat.email?.toLowerCase()
     if (!email) return false
     const domain = email.split('@')[1]
     return !!domain && !personalDomains.includes(domain)
   }

   async function getCompanySeats() {
     const all = await Seat.find({})
     return all.filter(isCompanySeat)
   }

   async function computeFleetKpis(): Promise<FleetKpis> {
     const companySeats = await getCompanySeats()
     const billableCount = companySeats.length
     const totalCostUsd = billableCount * MONTHLY_COST_USD

     // Fleet utilization: weighted avg of 7d_pct across company seats
     const latestSnaps = await latestSnapshotsFor(companySeats)
     const utilPct = avg(latestSnaps.map(s => s.seven_day_pct))

     const wasteUsd = totalCostUsd * (1 - utilPct / 100)

     // W/W delta: compute same metric 7 days ago (same @inet.vn filter applied)
     const lastWeekUtil = await computeHistoricalFleetUtil(7)
     const wwDelta = utilPct - lastWeekUtil

     // Worst forecast: only company seats
     const forecasts = await computeAllSeatForecasts(companySeats.map(s => s._id))
     const worst = forecasts.find(f => f.hours_to_full != null) ?? null

     return { utilPct, wasteUsd, wasteHours, totalCostUsd, billableCount, wwDelta, worstForecast: worst }
   }
   ```

2. **Service: user efficiency (company seats only)**
   - Get company seats (via `getCompanySeats()`), collect users assigned to them
   - IGNORE users only on personal-domain seats (không thuộc phạm vi BLD)
   - Per-user metric: sum of their seats' 7d_pct divided by their share
   - Rank top 5 / bottom 5

3. **Service: rebalance suggestions (MEMBER-focused, company seats only)**
   - Chỉ xét seats pass `isCompanySeat`; personal-domain seats hoàn toàn không vào analysis
   - Rule 1 (member swap): nếu seat A util <30% AND seat B util >80% for 3+ days
     → suggest move 1 heavy user từ B sang A
     → Return: `{ type: 'move_user', fromSeatId: B, toSeatId: A, userId, reason, utilGainEstimate }`
   - Rule 2 (add seat): nếu ≥2 billable seats ở critical/warning band ≥3 ngày liên tiếp
     → suggest add 1 seat
     → Return: `{ type: 'add_seat', reason: 'N seats quá tải kéo dài', estimatedMonthlyCost: 125 }`
   - Rule 3 (reassign user): nếu user dùng <10% share seat 14+ ngày
     → suggest reassign sang seat under-utilized
     → Return: `{ type: 'reassign_user', userId, currentSeatId, targetSeatId, reason }`
   - KHÔNG suggest cắt seat (gói Teams min 5)

4. **Routes** (`bld-metrics.ts`)
   - All 3 endpoints under `requireAdmin` middleware
   - Cache layer: in-memory LRU, 5min TTL

### Frontend

5. **Page** `/bld` — compose 4 components, admin guard via `use-auth`
6. **Hook `use-bld-metrics.ts`** — React Query, 5min staleTime
7. **Component `bld-fleet-kpi-cards.tsx`** — 4 big cards (shadcn Card):
   - Fleet Util (%) with ring progress + color: <50 red, 50-70 amber, >70 green
   - Waste $/month with sub-text "cơ hội tối ưu qua rebalance member"
   - W/W Δ with arrow up/down + color
   - Worst Forecast with ETA + seat label
8. **Component `bld-ww-comparison-chart.tsx`** — Recharts area, 8 weeks
9. **Component `bld-user-efficiency-panel.tsx`** — table top/bottom 5 billable users
10. **Component `bld-actions-panel.tsx`** — list suggestions grouped by type:
    - "Di chuyển member" (move_user) — Apply opens user reassign dialog
    - "Phân công lại" (reassign_user) — similar flow
    - "Đề xuất thêm seat" (add_seat) — info card + contact BLD button
    KHÔNG có action cắt seat (gói min 5)

### Nav + Route
11. Add sidebar link "BLD View" (admin-only via role check)
12. Mount route in `app.tsx`

### Tests
13. `tests/api/bld-metrics.test.ts` — service unit tests
    - `isCompanySeat` correctness: excludes personal domains, includes others
    - Case-insensitive: `User@GMAIL.COM` → excluded
    - Null/undefined/empty email → excluded (safe default)
    - Env override: `PERSONAL_EMAIL_DOMAINS` respected
- Env override: `SEAT_MONTHLY_COST_USD` respected (default 125)
- Invalid env cost (NaN/negative) → fallback to default 125
    - Fixture: mix personal + corporate seats → verify personal excluded EVERYWHERE
    - Fleet util computation (company seats only)
    - Waste $ computation
    - W/W delta with fixtures
    - User efficiency excludes users only on personal seats

## Todo List

- [ ] Backend: bld-metrics-service.ts (computeFleetKpis)
- [ ] Backend: computeUserEfficiency
- [ ] Backend: computeRebalanceSuggestions
- [ ] Backend: bld-metrics routes with requireAdmin
- [ ] Backend: in-memory cache 5min TTL
- [ ] Shared types: FleetKpis, UserEfficiency, RebalanceSuggestion
- [ ] Frontend: page `/bld` + route
- [ ] Frontend: hook use-bld-metrics
- [ ] Frontend: bld-fleet-kpi-cards
- [ ] Frontend: bld-ww-comparison-chart
- [ ] Frontend: bld-user-efficiency-panel
- [ ] Frontend: bld-actions-panel
- [ ] Nav: sidebar link admin-only
- [ ] Tests: bld-metrics service unit tests
- [ ] Typecheck both packages
- [ ] Visual smoke test `/bld` page

## Success Criteria
- Fleet util %, waste $, W/W delta visible in <2s
- Billable filter matches @inet.vn count manually verified
- 8-week W/W chart renders correctly
- Rebalance suggestions surface when thresholds met
- Tests pass

## Risks
- Historical W/W data quality — some seats may have gaps in old snapshots → handle null
- Rebalance rule may false-positive → start with rule-based, refine later (YAGNI for ML)
- Email domain case sensitivity → lowercase trước khi compare
- Seats đổi email → rely on current `seat.email`, re-query mỗi request (không cache long-term)
- Nếu không có company seat nào → BLD view hiển thị empty state với message giải thích + link config ENV
- Personal domain list chưa đầy đủ (e.g. custom mail provider) → admin bổ sung qua `PERSONAL_EMAIL_DOMAINS` env

## Security
- `/bld` route admin-only (client + server check)
- Cost data sensitive → no leak to non-admin

## Next Steps
- → Phase 3 (PDF Digest + Alert Settings)
