---
name: dashboard-reset-time-display
status: completed
created: 2026-04-05
slug: dashboard-reset-time-display
blockedBy: []
blocks: []
---

# Dashboard Reset Time Display

## Problem
Dashboard không hiển thị thời gian reset quota 5h/7d. User không biết khi nào quota refresh → khó plan usage. Data đã có sẵn trong DB + API response. Pure UI gap.

## Goals
- Shared formatter helper cho reset time (relative + absolute VN format)
- Hiển thị reset time ở 4 surfaces: QuotaForecastBar, dashboard-detail-table, dashboard-seat-usage-chart, dashboard-stat-overview
- Consistent format + null/past/imminent edge cases

## Context links
- Brainstorm: `plans/dattqh/reports/brainstorm-260405-1700-dashboard-reset-time-display.md`

## Phases
| # | Phase | Status |
|---|-------|--------|
| 1 | [Format helper + tests](./phase-01-format-helper.md) | completed |
| 2 | [API extension — resets_at in QuotaForecast](./phase-02-api-extension.md) | completed |
| 3 | [UI wiring — 4 components](./phase-03-ui-wiring.md) | completed |

## Dependencies
- Phase 1 → Phase 3 (UI uses helper)
- Phase 2 → Phase 3 (QuotaForecastBar uses API response)

## Success criteria
- Reset time visible ở 4 surfaces với format giống nhau
- Null/past/imminent edge cases handle đúng
- Helper tests cover: today/tomorrow/next-week/null/past
- `pnpm test` pass
- All files <200 LOC
