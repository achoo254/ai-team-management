# Phase 2: Backend — Token-First POST /api/seats

**Priority:** High | **Status:** pending | **Depends:** Phase 1

## Goal

Modify `POST /api/seats` để hỗ trợ token-first creation: nhận credential JSON, auto-fetch profile, create seat atomically.

## Tasks

### 2.1 Update `POST /api/seats` route

**File:** `packages/api/src/routes/seats.ts`

**New body schema:**
```typescript
{
  credential_json: string       // required
  max_users: number              // required (default 2 client-side)
  label?: string                 // optional override, default = account.full_name
  manual_mode?: boolean          // if true, skip profile API and require email+label
  email?: string                 // required when manual_mode=true
}
```

**Logic (happy path):**
1. Parse `credential_json` via `parseCredentialJson`
2. If parse fails → 400
3. If `manual_mode !== true`:
   - Call `fetchOAuthProfile(accessToken)`
   - Profile fail → 502 (or 401 if token invalid)
   - `email = profile.account.email`
   - `default_label = profile.account.full_name`
4. Else (`manual_mode === true`):
   - Require `email` + `label` in body
   - `default_label = body.label`
5. Check duplicate: `Seat.findOne({ email, deleted_at: null })` → if exists 409 `{ error: "Seat with this email already exists. Use Update Token to refresh credentials.", duplicate_seat_id }`
6. Create seat:
   ```typescript
   Seat.create({
     email,
     label: body.label || default_label,
     max_users: body.max_users,
     owner_id: req.user._id,
     oauth_credential: {
       access_token: encrypt(parsed.accessToken),
       refresh_token: parsed.refreshToken ? encrypt(parsed.refreshToken) : null,
       expires_at: parsed.expiresAt ? new Date(parsed.expiresAt) : null,
       scopes: parsed.scopes,
       subscription_type: parsed.subscriptionType,
       rate_limit_tier: parsed.rateLimitTier,
     },
     token_active: true,
   })
   ```
7. Return 201 `{ seat }` (strip tokens via existing toJSON transform)

### 2.2 Backward compat / deprecation

**Decision:** `credential_json` is now **required** in create payload. No silent fallback to old params.

Remove / deprecate old schema (email + label without credential_json). If any external caller still uses old schema → return 400 with clear message.

Check if any tests/callers use old schema → update them.

### 2.3 Error response consistency

| Case | Status | Body |
|---|---|---|
| Invalid JSON | 400 | `{ error: "Invalid credential JSON" }` |
| Missing access_token | 400 | `{ error: "access_token missing from credential" }` |
| Profile API 401 | 401 | `{ error: "Token invalid or expired" }` |
| Profile API other error | 502 | `{ error: "Profile API unreachable" }` |
| Duplicate email | 409 | `{ error: "...", duplicate_seat_id: "..." }` |
| manual_mode missing email/label | 400 | `{ error: "email and label required in manual mode" }` |

## Files

**Modify:**
- `packages/api/src/routes/seats.ts` — rewrite `POST /` handler

**No new models/schema changes** — Seat model unchanged.

## Testing

Add `tests/api/seats.test.ts` cases:
- Happy path: valid credential + profile returns email/name → seat created correctly
- Profile API 401 → 401 response
- Profile API timeout/500 → 502 response
- Duplicate email → 409 with `duplicate_seat_id`
- Manual mode: valid credential + email/label → seat created, profile NOT called
- Manual mode: missing email → 400
- Invalid JSON → 400
- Label override: body.label wins over full_name

Mock `fetchOAuthProfile` via vitest spy.

## Success Criteria

- [ ] `POST /api/seats` accepts new token-first schema
- [ ] Profile auto-fetch works, populates email + label
- [ ] Duplicate email rejected with actionable error
- [ ] Manual mode fallback works without profile API call
- [ ] Seat created atomically (email + credentials + token_active in 1 insert)
- [ ] All new tests pass
- [ ] Existing `PUT /:id/token` route untouched
