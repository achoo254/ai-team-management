---
name: efficiency-card-friendly-metrics
status: completed
created: 2026-04-05
slug: efficiency-card-friendly-metrics
blockedBy: []
blocks: []
---

# Efficiency Card — Friendly Metrics + Quota Forecast

## Problem
Card "Hiệu suất sử dụng" (`packages/web/src/components/dashboard-efficiency.tsx`) dùng thuật ngữ kỹ thuật (`Δ7d`, `Tác động 5h→7d`, `impact_ratio`) user không hiểu, không hành động được.

## Goals
- Reframe metrics sang ngôn ngữ business: "phiên hiệu quả X/Y", progress bar quota, dự báo hết quota.
- Thêm forecast "quota 7d sẽ full vào ngày/giờ nào" qua linear regression per-seat.
- Drop Sonnet/Opus split (dữ liệu Opus gần như 0).

## Approach
Hướng B — Practical Reframe (đã approve trong brainstorm).

Forecast: linear regression 24h trên `usage_snapshots.seven_day_pct` per seat, chọn seat có `forecast_at` sớm nhất làm cảnh báo team.

## Context links
- Brainstorm: `plans/dattqh/reports/brainstorm-260405-1630-efficiency-card-friendly-metrics.md`
- Target file: `packages/web/src/components/dashboard-efficiency.tsx`
- API route: `packages/api/src/routes/dashboard.ts:274-421` (GET `/efficiency`)

## Phases
| # | Phase | Status |
|---|-------|--------|
| 1 | [Forecast service — linear regression](./phase-01-forecast-service.md) | completed |
| 2 | [Backend API — extend /efficiency response](./phase-02-backend-api.md) | completed |
| 3 | [Shared types update](./phase-03-shared-types.md) | completed |
| 4 | [Frontend redesign card + QuotaForecastBar](./phase-04-frontend-redesign.md) | completed |
| 5 | [Tests — forecast + UI](./phase-05-tests.md) | completed |

## Dependencies
- Phase 1 → Phase 2 (backend uses forecast service)
- Phase 2 → Phase 3 (types mirror API shape)
- Phase 3 → Phase 4 (frontend consumes types)
- Phase 4 → Phase 5 (test verifies final code)

## Success criteria
- User không cần hỏi nghĩa label nào trong card
- Forecast "seat X hết quota vào Thứ Y ~HH:MM" hiển thị đúng với usage patterns test
- Không metric kỹ thuật (`Δ7d`, `impact_ratio`) còn visible
- Card <200 LOC
- Tests pass (unit forecast + UI snapshot)
