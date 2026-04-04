---
phase: 3
status: done
priority: high
depends_on: [phase-01]
---

# Phase 3: API Route Updates

## Overview
Update token CRUD routes to accept full OAuth credential JSON. Add credential parsing logic.

## Related Code Files
- **Modify:** `packages/api/src/routes/seats.ts`

## Implementation Steps

### 1. Update `PUT /api/seats/:id/token`

Accept two input formats:

**Format A — Raw JSON (credential_json):**
```json
{
  "credential_json": "{\"claudeAiOauth\":{\"accessToken\":\"sk-ant-oat01-...\",\"refreshToken\":\"sk-ant-ort01-...\",\"expiresAt\":1775245862619,\"scopes\":[...],\"subscriptionType\":\"team\",\"rateLimitTier\":\"default_claude_max_5x\"}}"
}
```

**Format B — Structured fields (backward compat):**
```json
{
  "access_token": "sk-ant-oat01-...",
  "refresh_token": "sk-ant-ort01-...",
  "expires_at": 1775245862619,
  "scopes": ["user:inference", ...],
  "subscription_type": "team",
  "rate_limit_tier": "default_claude_max_5x"
}
```

**Parsing logic:**

```typescript
function parseCredential(body: Record<string, unknown>) {
  // Format A: raw JSON string
  if (body.credential_json && typeof body.credential_json === 'string') {
    const parsed = JSON.parse(body.credential_json)
    const cred = parsed.claudeAiOauth || parsed
    return {
      access_token: cred.accessToken || cred.access_token,
      refresh_token: cred.refreshToken || cred.refresh_token || null,
      expires_at: cred.expiresAt || cred.expires_at || null,
      scopes: cred.scopes || [],
      subscription_type: cred.subscriptionType || cred.subscription_type || null,
      rate_limit_tier: cred.rateLimitTier || cred.rate_limit_tier || null,
    }
  }
  // Format B: structured fields
  return {
    access_token: body.access_token as string,
    refresh_token: (body.refresh_token as string) || null,
    expires_at: (body.expires_at as number) || null,
    scopes: (body.scopes as string[]) || [],
    subscription_type: (body.subscription_type as string) || null,
    rate_limit_tier: (body.rate_limit_tier as string) || null,
  }
}
```

**Route handler update:**

```typescript
router.put('/:id/token', authenticate, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id as string
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid seat ID' })
      return
    }

    const cred = parseCredential(req.body)
    if (!cred.access_token || typeof cred.access_token !== 'string') {
      res.status(400).json({ error: 'access_token is required' })
      return
    }

    const oauth_credential = {
      access_token: encrypt(cred.access_token),
      refresh_token: cred.refresh_token ? encrypt(cred.refresh_token) : null,
      expires_at: cred.expires_at ? new Date(cred.expires_at) : null,
      scopes: cred.scopes,
      subscription_type: cred.subscription_type,
      rate_limit_tier: cred.rate_limit_tier,
    }

    const seat = await Seat.findByIdAndUpdate(
      id,
      { oauth_credential, token_active: true, last_fetch_error: null },
      { new: true },
    )
    if (!seat) {
      res.status(404).json({ error: 'Seat not found' })
      return
    }

    res.json({ message: 'Credential updated', seat })
  } catch (error) {
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: 'Invalid JSON format' })
      return
    }
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})
```

### 2. Update `DELETE /api/seats/:id/token`

Clear entire oauth_credential subdocument:

```typescript
const seat = await Seat.findByIdAndUpdate(
  id,
  { oauth_credential: null, token_active: false, last_fetch_error: null, last_refreshed_at: null },
  { new: true },
)
```

### 3. Update GET seats list enrichment

In `GET /api/seats`, the `has_token` enrichment currently checks `seat.token_active`. Should also expose `oauth_credential` metadata (without tokens) for UI display.

Update the enrichment in the GET handler to include credential metadata. Since `select: false` excludes oauth_credential by default, we need a separate query or adjust the transform to let metadata through.

**Approach:** Keep `select: false` on full subdocument. In the GET enrichment, run a separate lean query with projection to get only metadata fields:

```typescript
const credMeta = await Seat.find({}, {
  'oauth_credential.expires_at': 1,
  'oauth_credential.scopes': 1,
  'oauth_credential.subscription_type': 1,
  'oauth_credential.rate_limit_tier': 1,
}).lean()
```

Merge into enriched response. Or simpler: change `select: false` to field-level select on access_token/refresh_token only (more complex schema). 

**Simplest approach:** Use `.select('+oauth_credential')` in the GET seats route, and rely on `toJSON` transform to strip tokens. The metadata (expires_at, scopes, etc.) will pass through.

## Todo
- [ ] Add `parseCredential()` helper function in seats.ts
- [ ] Update PUT /api/seats/:id/token to use parseCredential
- [ ] Update DELETE /api/seats/:id/token to clear oauth_credential
- [ ] Update GET /api/seats to expose credential metadata via toJSON
- [ ] Compile check: `pnpm build`

## Success Criteria
- PUT accepts both credential_json and structured fields
- Tokens encrypted, metadata stored plain
- DELETE clears entire credential
- GET returns metadata (expires_at, scopes) without tokens
