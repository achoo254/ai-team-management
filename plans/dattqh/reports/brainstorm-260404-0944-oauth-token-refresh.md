# Brainstorm: OAuth Token Refresh & Enhanced Credential Management

**Date:** 2026-04-04
**Status:** Approved → Plan creation

## Problem
- Access token expires ~8h, no auto-refresh → usage collection fails → admin manual re-import
- UI only supports single access_token input, no refresh_token/expiry info
- No token lifecycle management

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data model | Subdocument `oauth_credential` in Seat | Logical grouping, clean add/remove |
| UI input | Paste JSON + Upload file (both) | Flexibility |
| Refresh strategy | Cron every 5min check expiring tokens | Background, no API call delay |
| Extra fields | scopes, subscriptionType, rateLimitTier | Display on UI + debug |
| Error handling | Mark inactive + Telegram alert | Fast admin awareness |

## Design Summary

### Model: Seat.oauth_credential subdocument
```
oauth_credential: {
  access_token: encrypted string
  refresh_token: encrypted string
  expires_at: Date
  scopes: string[]
  subscription_type: string | null
  rate_limit_tier: string | null
}
```

### Token Refresh Service (new)
- `refreshTokenForSeat(seat)` → POST `https://api.anthropic.com/v1/oauth/token`
  - Body: `{ grant_type: "refresh_token", refresh_token, client_id: "9d1c250a-e61b-44d9-88ed-5944d1962f5e" }`
- `checkAndRefreshExpiring()` → find seats with expires_at < now+5min → refresh each
- On success: update oauth_credential fields
- On fail: token_active=false + save error + Telegram alert

### Cron: every 5min → checkAndRefreshExpiring()

### API Changes
- `PUT /api/seats/:id/token` → accept `credential_json` (raw JSON) or structured fields
- Server parse claudeAiOauth wrapper, encrypt, save

### UI: seat-token-dialog.tsx
- Tab: Paste JSON (textarea) + Upload File (.json)
- Parse preview before save
- Display: expiry countdown, scopes badges, subscription type, rate limit tier

### Refresh API Details
- Endpoint: `POST https://api.anthropic.com/v1/oauth/token`
- Fixed client_id: `9d1c250a-e61b-44d9-88ed-5944d1962f5e`
- Response: new access_token, refresh_token, expires_in (seconds) → compute expires_at

## Risks
- Refresh token revoked → mark inactive + alert
- Race condition refresh/usage cron → mutex per seat
- Old seats without refresh_token → skip auto-refresh, work as before

## Affected Files
- `packages/api/src/models/seat.ts`
- `packages/api/src/services/token-refresh-service.ts` (new)
- `packages/api/src/services/usage-collector-service.ts`
- `packages/api/src/routes/seats.ts`
- `packages/api/src/index.ts` (cron)
- `packages/shared/types.ts`
- `packages/web/src/components/seat-token-dialog.tsx`
- `packages/web/src/hooks/use-usage-snapshots.ts`
