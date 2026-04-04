---
name: OAuth Token Refresh & Enhanced Credential Management
status: in-progress
created: 2026-04-04
branch: main
phases: 4
blockedBy: []
blocks: []
---

# OAuth Token Refresh & Enhanced Credential Management

## Context
- [Brainstorm Report](../reports/brainstorm-260404-0944-oauth-token-refresh.md)

## Problem
Access tokens expire ~8h. No auto-refresh → usage collection fails → admin manual re-import. UI only supports bare access_token input.

## Solution
1. Expand Seat model with `oauth_credential` subdocument (access_token, refresh_token, expires_at, metadata)
2. New `token-refresh-service.ts` — auto-refresh via Anthropic OAuth API
3. Cron every 5min checks expiring tokens
4. Enhanced UI: paste JSON + upload file, parse preview, metadata display

## Phases

| # | Phase | Status | Files |
|---|-------|--------|-------|
| 1 | [Model & Types](phase-01-model-and-types.md) | done | seat.ts, types.ts |
| 2 | [Token Refresh Service & Cron](phase-02-token-refresh-service.md) | done | token-refresh-service.ts (new), usage-collector-service.ts, index.ts, telegram-service.ts |
| 3 | [API Route Updates](phase-03-api-routes.md) | done | seats.ts |
| 4 | [Frontend UI](phase-04-frontend-ui.md) | done | seat-token-dialog.tsx, use-usage-snapshots.ts, types.ts |

## Dependencies
- Phase 2 depends on Phase 1
- Phase 3 depends on Phase 1
- Phase 4 depends on Phase 1 & 3

## Key Constants
- `CLIENT_ID`: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- Refresh endpoint: `POST https://api.anthropic.com/v1/oauth/token`
- Token expiry check: 5 minutes before `expires_at`
