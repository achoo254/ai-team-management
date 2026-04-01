---
phase: 3
status: done
effort: 15m
---

# Phase 3: Tests & Docs — Remove Sonnet References

## Test Files

### 1. `tests/api/usage-log.test.ts`
- Remove `weeklySonnetPct` from all test payloads
- Remove `weekly_sonnet_pct` assertions

### 2. `tests/api/dashboard.test.ts`
- Remove `avgSonnetPct` property checks
- Remove `weekly_sonnet_pct` from test data setup

### 3. `tests/services/usage-sync-service.test.ts`
- Remove `weeklySonnetPct` from all `logUsage()` calls
- Remove `weekly_sonnet_pct` assertions

### 4. `tests/services/alert-service.test.ts`
- Remove `weekly_sonnet_pct` from all test fixture objects

### 5. `tests/services/telegram-service.test.ts`
- Remove `weekly_sonnet_pct` from test data

### 6. `tests/hooks/use-dashboard.test.ts`
- Remove `sonnet_pct` from usagePerSeat mock
- Remove `avg_sonnet` from usageTrend mock
- Remove `weekly_sonnet_pct` from mock data

### 7. `tests/hooks/use-usage-log.test.ts`
- Remove `weeklySonnetPct` from mock data and payloads

### 8. `tests/ui/stat-cards.test.tsx`
- Remove `sonnet_pct` from test data

### 9. `tests/helpers/db-helper.ts`
- Remove `weekly_sonnet_pct` from helper fixtures

## Doc Files

### 1. `docs/system-architecture.md`
- Remove `weekly_sonnet_pct` from schema docs

### 2. `docs/project-overview-pdr.md`
- Remove `sonnet_pct` from feature description
- Remove per-model breakdown mention (Claude 3.5 Sonnet, Opus, Haiku)

### 3. `docs/codebase-summary.md`
- Remove `weekly_sonnet_pct` from schema docs

## Todo
- [ ] Update all test files
- [ ] Update docs
- [ ] Tests pass
