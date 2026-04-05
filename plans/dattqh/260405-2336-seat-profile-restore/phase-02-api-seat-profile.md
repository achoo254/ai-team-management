# Phase 2: API — Seat Model + Profile Endpoints

**Priority:** High
**Status:** Done
**Est:** 1.5h
**Depends on:** Phase 1 (shared types)

## Context Links
- Seat model: `packages/api/src/models/seat.ts`
- Anthropic service: `packages/api/src/services/anthropic-service.ts`
- Seats routes: `packages/api/src/routes/seats.ts`
- Shared types: `packages/shared/types.ts`

## Overview

Extend Seat Mongoose schema with `profile` subdocument. Add GET/POST profile endpoints. Wire auto-fetch on seat creation and token update.

## Key Insights

- `fetchOAuthProfile` already called in POST /seats and POST /preview-token — just need to persist the result
- Profile is a cache, not source of truth — can always re-fetch from Anthropic
- 6h staleness threshold: GET /profile auto-refreshes if `profile.fetched_at` older than 6h
- `toJSON` transform already strips OAuth tokens — profile has no sensitive data, no stripping needed

## Data Flow

```
POST /seats (create)
  → fetchOAuthProfile(token) → OAuthProfile
  → toProfileCache(oauthProfile) → profile subdoc
  → Seat.create({ ...fields, profile })

GET /seats/:id/profile
  → Seat.findById(id)
  → if !profile || stale(>6h): fetch + update + return fresh
  → else: return cached

POST /seats/:id/profile/refresh
  → Seat.findById(id).select('+oauth_credential')
  → decrypt token → fetchOAuthProfile → toProfileCache → save
  → return updated profile

PUT /seats/:id/token
  → (existing logic) → also fetch profile and save
```

## Related Code Files

**Modify:**
- `packages/api/src/models/seat.ts` — add `profile` subdocument to schema + ISeat interface
- `packages/api/src/services/anthropic-service.ts` — add `toProfileCache()` helper
- `packages/api/src/routes/seats.ts` — add 2 endpoints, modify POST / and PUT /:id/token

## Implementation Steps

### 1. Extend ISeat interface + schema (`models/seat.ts`)

Add to `ISeat`:
```typescript
profile: {
  account_name: string | null
  display_name: string | null
  org_name: string | null
  org_type: string | null
  billing_type: string | null
  rate_limit_tier: string | null
  subscription_status: string | null
  has_claude_max: boolean
  has_claude_pro: boolean
  fetched_at: Date | null
} | null
```

Add to schema (after `last_refreshed_at`):
```typescript
profile: {
  type: {
    account_name: { type: String, default: null },
    display_name: { type: String, default: null },
    org_name: { type: String, default: null },
    org_type: { type: String, default: null },
    billing_type: { type: String, default: null },
    rate_limit_tier: { type: String, default: null },
    subscription_status: { type: String, default: null },
    has_claude_max: { type: Boolean, default: false },
    has_claude_pro: { type: Boolean, default: false },
    fetched_at: { type: Date, default: null },
  },
  default: null,
},
```

### 2. Add `toProfileCache()` helper (`services/anthropic-service.ts`)

```typescript
/** Map OAuthProfile API response → flat profile cache object for Seat.profile */
export function toProfileCache(p: OAuthProfile) {
  return {
    account_name: p.account.full_name,
    display_name: p.account.display_name,
    org_name: p.organization.name,
    org_type: p.organization.organization_type,
    billing_type: p.organization.billing_type,
    rate_limit_tier: p.organization.rate_limit_tier,
    subscription_status: p.organization.subscription_status,
    has_claude_max: p.account.has_claude_max,
    has_claude_pro: p.account.has_claude_pro,
    fetched_at: new Date(),
  }
}
```

### 3. Wire profile save in POST /seats (`routes/seats.ts`)

In the non-manual-mode branch where `fetchOAuthProfile` is already called, after getting `profile`:
```typescript
const profileCache = toProfileCache(profile)
// ... then in Seat.create():
Seat.create({ ...fields, profile: profileCache })
```

### 4. Wire profile save in PUT /:id/token (`routes/seats.ts`)

After updating credential, attempt profile fetch (best-effort, don't fail the token update):
```typescript
// After credential update succeeds:
try {
  const plainToken = cred.access_token
  const oauthProfile = await fetchOAuthProfile(plainToken)
  await Seat.findByIdAndUpdate(id, { profile: toProfileCache(oauthProfile) })
} catch {
  // Non-critical — profile will be fetched lazily
}
```

Note: `cred.access_token` here is the **plaintext** token from `parseCredential()` — before encryption. Must use it before the encrypt call, or restructure slightly.

### 5. Add GET /seats/:id/profile endpoint

Place **before** the generic `/:id` PUT route to avoid param conflicts. Use `requireSeatOwnerOrAdmin()`.

```typescript
const PROFILE_STALE_MS = 6 * 60 * 60 * 1000 // 6 hours

router.get('/:id/profile', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const seat = await Seat.findById(req.params.id).select('+oauth_credential').lean()
    if (!seat) { res.status(404).json({ error: 'Seat not found' }); return }

    const isStale = !seat.profile?.fetched_at ||
      Date.now() - new Date(seat.profile.fetched_at).getTime() > PROFILE_STALE_MS

    if (!isStale && seat.profile) {
      res.json({ profile: seat.profile })
      return
    }

    // Auto-refresh if token active
    if (!seat.token_active || !seat.oauth_credential?.access_token) {
      // Return stale/null profile — can't refresh without token
      res.json({ profile: seat.profile ?? null, stale: true })
      return
    }

    const token = decrypt(seat.oauth_credential.access_token)
    const oauthProfile = await fetchOAuthProfile(token)
    const fresh = toProfileCache(oauthProfile)
    await Seat.findByIdAndUpdate(req.params.id, { profile: fresh })
    res.json({ profile: fresh })
  } catch (error) {
    // If refresh fails, return cached (possibly null)
    const seat = await Seat.findById(req.params.id, 'profile').lean()
    res.json({ profile: seat?.profile ?? null, stale: true, refresh_error: true })
  }
})
```

### 6. Add POST /seats/:id/profile/refresh endpoint

```typescript
router.post('/:id/profile/refresh', authenticate, validateObjectId('id'), requireSeatOwnerOrAdmin(), async (req, res) => {
  try {
    const seat = await Seat.findById(req.params.id).select('+oauth_credential')
    if (!seat) { res.status(404).json({ error: 'Seat not found' }); return }
    if (!seat.token_active || !seat.oauth_credential?.access_token) {
      res.status(422).json({ error: 'No active token — cannot refresh profile' })
      return
    }

    const token = decrypt(seat.oauth_credential.access_token)
    const oauthProfile = await fetchOAuthProfile(token)
    const fresh = toProfileCache(oauthProfile)
    seat.profile = fresh as any
    await seat.save()
    res.json({ profile: fresh })
  } catch (error) {
    if (error instanceof OAuthProfileError && error.status === 401) {
      res.status(422).json({ error: 'Token invalid or expired' })
      return
    }
    const message = error instanceof Error ? error.message : 'Profile refresh failed'
    res.status(502).json({ error: message })
  }
})
```

## File Size Concern

`routes/seats.ts` is currently 529 LOC. Adding ~60 LOC for profile endpoints pushes it to ~590. Still manageable but monitor. If further routes added later, consider extracting profile routes to `routes/seat-profile.ts` and mounting as sub-router.

## Todo List

- [ ] Add `profile` to `ISeat` interface in `models/seat.ts`
- [ ] Add `profile` subdocument to Mongoose schema in `models/seat.ts`
- [ ] Add `toProfileCache()` to `services/anthropic-service.ts`
- [ ] Import `toProfileCache` + `decrypt` in `routes/seats.ts`
- [ ] Save profile in POST /seats (non-manual-mode branch)
- [ ] Save profile in PUT /:id/token (best-effort after credential update)
- [ ] Add GET /:id/profile endpoint with 6h auto-refresh
- [ ] Add POST /:id/profile/refresh endpoint
- [ ] Typecheck: `pnpm -F @repo/api build`
- [ ] Manual test: create seat → verify profile populated
- [ ] Manual test: GET /profile → verify cached return + auto-refresh when stale

## Success Criteria

- `Seat.profile` populated on create (non-manual-mode)
- GET /profile returns cached data, auto-refreshes if stale >6h
- POST /profile/refresh force-fetches from Anthropic
- PUT /:id/token also updates profile (best-effort)
- All existing seat tests still pass

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| fetchOAuthProfile timeout on GET /profile | 10s AbortSignal already in place; return stale on failure |
| Token expired when auto-refreshing profile | Return stale profile with `stale: true` flag; don't break GET |
| `routes/seats.ts` file size growing | Monitor; extract to sub-router if exceeds 650 LOC |

## Security Considerations

- Profile endpoints gated by `requireSeatOwnerOrAdmin` — same as other seat routes
- Profile data contains no secrets (names, org info, tier — all non-sensitive)
- OAuth token only decrypted server-side for Anthropic API call, never exposed in response
