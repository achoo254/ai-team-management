# Phase 1: Shared Helper + Profile Service + Preview Endpoint

**Priority:** High | **Status:** pending

## Goal

Extract credential parser, add OAuth profile fetcher service, add preview endpoint.

## Tasks

### 1.1 Extract `parseCredentialJson()` helper

**Source:** `packages/web/src/components/seat-token-dialog.tsx:28-46` (`tryParse`)

**Target:** `packages/shared/credential-parser.ts` (new file)

**Exports:**
```typescript
export interface ParsedCredential {
  accessToken: string
  refreshToken: string | null
  expiresAt: number | null
  scopes: string[]
  subscriptionType: string | null
  rateLimitTier: string | null
}

export function parseCredentialJson(raw: string): ParsedCredential | null
```

Accept both `claudeAiOauth` wrapper and raw object. Accept snake_case + camelCase keys.

### 1.2 Update `seat-token-dialog.tsx` to use shared helper

- Remove local `tryParse()` + `ParsedCredential` interface
- Import from `@repo/shared/credential-parser`
- Verify behavior unchanged

### 1.3 Add `fetchOAuthProfile()` service function

**File:** `packages/api/src/services/anthropic-service.ts`

```typescript
export interface OAuthProfile {
  account: {
    uuid: string
    email: string
    full_name: string
    display_name: string
    has_claude_max: boolean
    has_claude_pro: boolean
    created_at: string
  }
  organization: {
    uuid: string
    name: string
    organization_type: string
    billing_type: string
    rate_limit_tier: string
    has_extra_usage_enabled: boolean
    subscription_status: string
    subscription_created_at: string
  }
  application: { uuid: string; name: string; slug: string }
}

export async function fetchOAuthProfile(accessToken: string): Promise<OAuthProfile>
```

- URL: `https://api.anthropic.com/api/oauth/profile`
- Headers: `Authorization: Bearer {token}`, `anthropic-beta: oauth-2025-04-20`, `content-type: application/json`
- Timeout: 10s (use `AbortSignal.timeout(10_000)`)
- Throw on non-2xx with `{ status, body }` preserved

### 1.4 Add `POST /api/seats/preview-token` endpoint

**File:** `packages/api/src/routes/seats.ts`

**Auth:** `authenticate` (any logged-in user)

**Body:**
```typescript
{ credential_json: string }
```

**Response 200:**
```typescript
{
  account: { email, full_name, has_claude_max, has_claude_pro },
  organization: { name, organization_type, rate_limit_tier, subscription_status },
  duplicate_seat_id: string | null
}
```

**Logic:**
1. Parse `credential_json` (use shared parser — BE imports from `@repo/shared`)
2. If parse fails → 400 `{ error: "Invalid credential JSON" }`
3. Call `fetchOAuthProfile(accessToken)`
4. If fails with 401 → 401 `{ error: "Token invalid or expired" }`
5. If fails other → 502 `{ error: "Profile API unreachable" }`
6. Check duplicate: `Seat.findOne({ email: profile.account.email, deleted_at: null })`
7. Return selected fields + `duplicate_seat_id`

## Files

**Create:**
- `packages/shared/credential-parser.ts`

**Modify:**
- `packages/web/src/components/seat-token-dialog.tsx` (use shared helper)
- `packages/api/src/services/anthropic-service.ts` (add `fetchOAuthProfile` + `OAuthProfile` type)
- `packages/api/src/routes/seats.ts` (add preview-token route)

## Testing

- Unit test `parseCredentialJson`: claudeAiOauth wrapper, raw object, camelCase, snake_case, invalid JSON, missing access_token
- Unit test `fetchOAuthProfile`: mock fetch, 200/401/500/timeout cases
- Integration test `POST /preview-token`: happy path, invalid JSON, expired token, duplicate email detection

## Success Criteria

- [ ] `parseCredentialJson` exported from shared package, both web + api import it
- [ ] `seat-token-dialog.tsx` works unchanged after refactor
- [ ] `fetchOAuthProfile` returns typed profile or throws with useful error
- [ ] `POST /preview-token` returns 200/400/401/502 with correct bodies
- [ ] All new tests pass
