---
status: in-progress
priority: medium
effort: 1h
blockedBy: []
blocks: []
---

# Remove Sonnet-specific Fields — Keep Only "All Models"

**Goal:** Loại bỏ toàn bộ field/logic/UI/data liên quan đến Sonnet. Chỉ giữ lại tracking "all models".

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | [Backend: model + service + routes](phase-01-backend.md) | 25m | pending |
| 2 | [Frontend: hooks + components + pages](phase-02-frontend.md) | 20m | pending |
| 3 | [Tests + docs](phase-03-tests-docs.md) | 15m | pending |

## Key Decision

- **No rename**: `weekly_all_pct` / `all_pct` giữ nguyên tên — vẫn có nghĩa và tránh migration phức tạp.
- **MongoDB**: Không cần migration — field cũ tự mất khi document mới không ghi. Có thể `$unset` sau nếu cần.
- **Backward compat**: API response bỏ sonnet fields luôn, không giữ lại.

## Files to Modify

### Backend (packages/api)
- `src/models/usage-log.ts` — remove `weekly_sonnet_pct` from interface + schema
- `src/services/usage-sync-service.ts` — remove `weeklySonnetPct` param
- `src/services/telegram-service.ts` — remove sonnet_pct in report
- `src/routes/usage-log.ts` — remove weeklySonnetPct from bulk + week endpoints
- `src/routes/dashboard.ts` — remove avgSonnet, sonnet_pct, avg_sonnet from all 3 endpoints

### Shared
- `packages/shared/types.ts` — remove `weekly_sonnet_pct` from UsageLog interface

### Frontend (packages/web)
- `src/hooks/use-dashboard.ts` — remove sonnet_pct, avg_sonnet, weekly_sonnet_pct
- `src/hooks/use-usage-log.ts` — remove weeklySonnetPct
- `src/components/usage-bar-chart.tsx` — remove Sonnet Bar
- `src/components/trend-line-chart.tsx` — remove Sonnet Line
- `src/pages/log-usage.tsx` — remove weeklySonnetPct from save payload

### Tests
- `tests/api/usage-log.test.ts`
- `tests/api/dashboard.test.ts`
- `tests/services/usage-sync-service.test.ts`
- `tests/services/alert-service.test.ts`
- `tests/services/telegram-service.test.ts`
- `tests/hooks/use-dashboard.test.ts`
- `tests/hooks/use-usage-log.test.ts`
- `tests/ui/stat-cards.test.tsx`
- `tests/helpers/db-helper.ts`

### Docs
- `docs/system-architecture.md`
- `docs/project-overview-pdr.md`
- `docs/codebase-summary.md`
