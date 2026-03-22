# Phase 3: Anthropic API Integration

**Priority:** High | **Status:** pending | **Effort:** 1 day

## Overview
Service layer gọi Anthropic Admin API, sync usage data daily.

## API Reference
See: `plans/reports/researcher-260320-1339-anthropic-apis-reference.md`

## Auth
- Header: `x-api-key: sk-ant-admin-*` (from dattqh@inet.vn admin account)
- Header: `anthropic-version: 2023-06-01`

## Services

### anthropic-service.js
Core API client wrapping 4 endpoints:

```js
// Claude Code Analytics — per-user daily metrics
getClaudeCodeUsage(date)
// → GET /v1/organizations/usage_report/claude_code?starting_at={date}

// Usage Report — token breakdown by model/workspace
getMessagesUsage(startDate, endDate, groupBy)
// → GET /v1/organizations/usage_report/messages

// Cost Report — cost breakdown
getCostReport(startDate, endDate)
// → GET /v1/organizations/cost_report

// Organization Members
getMembers()
// → GET /v1/organizations/users
```

Handle pagination: loop while `has_more === true`, pass `next_page` as `page` param.

### usage-sync-service.js
Cron job chạy daily (6:00 AM):

1. Call `getClaudeCodeUsage(yesterday)`
2. Parse response → map to `usage_logs` table
3. Upsert per seat_email + date (UNIQUE constraint)
4. Store `raw_json` for audit trail
5. Check alert thresholds after sync

## Implementation Steps
- [ ] Create `server/services/anthropic-service.js` — API client with pagination
- [ ] Create `server/services/usage-sync-service.js` — daily sync logic
- [ ] Setup node-cron in `server/index.js` — schedule daily at 6:00 AM
- [ ] Add manual sync endpoint: `POST /api/sync` (admin only)
- [ ] Error handling: retry once on failure, log errors
- [ ] Test with real API key against Anthropic

## Key Considerations
- Claude Code Analytics returns **single day** per request → sync yesterday's data
- Rate limiting: no documented limits, but be conservative (1 req/sec)
- Data freshness: ~1 hour delay from Anthropic
- Store raw JSON for future audit needs

## Success Criteria
- `POST /api/sync` successfully pulls data from Anthropic
- Data stored in usage_logs with correct mapping
- Cron job runs daily without manual intervention
- Pagination handles >20 records correctly
