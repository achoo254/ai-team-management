---
phase: 1
status: done
effort: 25m
---

# Phase 1: Backend — Remove Sonnet Fields

## Files to Modify

### 1. `packages/api/src/models/usage-log.ts`
- Remove `weekly_sonnet_pct` from `IUsageLog` interface
- Remove `weekly_sonnet_pct` from schema definition

### 2. `packages/api/src/services/usage-sync-service.ts`
- Remove `weeklySonnetPct` from `LogUsageParams` interface
- Remove `weekly_sonnet_pct` from `logUsage()` create call

### 3. `packages/api/src/services/telegram-service.ts`
- Remove `weekly_sonnet_pct` from `logBySeat` type & lookup (~line 59)
- Remove `sonnet_pct` from `rows` mapping (~line 72)
- Remove `Sonnet: <b>${s.sonnet_pct}%</b>` line from message builder (~line 109)

### 4. `packages/api/src/routes/usage-log.ts`
- **POST /bulk**: Remove `weeklySonnetPct` destructure + `weekly_sonnet_pct` upsert field
- **GET /week**: Remove `weeklySonnetPct` from response mapping

### 5. `packages/api/src/routes/dashboard.ts`
- **GET /summary**: Remove `avgSonnet` variable, `$avg: '$weekly_sonnet_pct'` aggregation, `avgSonnetPct` from response
- **GET /enhanced**: Remove `weekly_sonnet_pct` from latestUsage aggregate `$first`, `usageMap` type, `sonnet_pct` from usagePerSeat, `avg_sonnet` from usageTrend aggregate + project
- **GET /usage/by-seat**: Remove `weekly_sonnet_pct` from aggregate `$first`, `usageMap` type, enriched mapping

### 6. `packages/shared/types.ts`
- Remove `weekly_sonnet_pct: number` from `UsageLog` interface

## Todo
- [ ] Update usage-log model
- [ ] Update usage-sync-service
- [ ] Update telegram-service
- [ ] Update usage-log routes
- [ ] Update dashboard routes
- [ ] Update shared types
- [ ] Compile check passes
