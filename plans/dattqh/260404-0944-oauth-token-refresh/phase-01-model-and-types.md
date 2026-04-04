---
phase: 1
status: done
priority: high
---

# Phase 1: Model & Types

## Overview
Expand Seat model with `oauth_credential` subdocument. Update shared types. Migrate existing `access_token` field.

## Related Code Files
- **Modify:** `packages/api/src/models/seat.ts`
- **Modify:** `packages/shared/types.ts`

## Implementation Steps

### 1. Update Seat Model (`packages/api/src/models/seat.ts`)

Replace flat `access_token` field with `oauth_credential` subdocument:

```typescript
export interface IOAuthCredential {
  access_token: string | null
  refresh_token: string | null
  expires_at: Date | null
  scopes: string[]
  subscription_type: string | null
  rate_limit_tier: string | null
}

export interface ISeat extends Document {
  email: string
  label: string
  team: 'dev' | 'mkt'
  max_users: number
  oauth_credential: IOAuthCredential | null  // replaces access_token
  token_active: boolean
  last_fetched_at: Date | null
  last_fetch_error: string | null
  last_refreshed_at: Date | null  // new: track last refresh time
  created_at: Date
}
```

Schema changes:
- Remove: `access_token: { type: String, default: null, select: false }`
- Add subdocument:
```typescript
oauth_credential: {
  type: {
    access_token: { type: String, default: null },
    refresh_token: { type: String, default: null },
    expires_at: { type: Date, default: null },
    scopes: { type: [String], default: [] },
    subscription_type: { type: String, default: null },
    rate_limit_tier: { type: String, default: null },
  },
  default: null,
  select: false,  // exclude from default queries
}
last_refreshed_at: { type: Date, default: null }
```

Update `toJSON` transform:
```typescript
seatSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    // Strip encrypted tokens, keep metadata
    if (ret.oauth_credential) {
      delete ret.oauth_credential.access_token
      delete ret.oauth_credential.refresh_token
    }
    return ret
  },
})
```

**Important:** `select: false` on the subdocument means callers needing tokens must use `.select('+oauth_credential')`.

### 2. Update Shared Types (`packages/shared/types.ts`)

Add:
```typescript
export interface OAuthCredentialMeta {
  expires_at: string | null
  scopes: string[]
  subscription_type: string | null
  rate_limit_tier: string | null
}
```

Update Seat interface:
```typescript
export interface Seat {
  _id: string
  email: string
  label: string
  team: 'dev' | 'mkt'
  max_users: number
  has_token?: boolean
  token_active?: boolean
  oauth_credential?: OAuthCredentialMeta | null  // new: metadata only (no tokens)
  last_fetched_at?: string | null
  last_fetch_error?: string | null
  last_refreshed_at?: string | null  // new
  created_at: string
}
```

### 3. Migration Strategy

No formal DB migration needed. Mongoose handles schema evolution:
- Old seats with `access_token` field → field becomes orphaned (ignored by new schema)
- Admin must re-import credentials for existing seats (old access_token-only format incompatible)
- **Alternative:** Write a one-time migration in `seed-data.ts` that checks for old `access_token` field and wraps it into `oauth_credential.access_token` (but without refresh_token, `expires_at` = null → won't auto-refresh, prompting re-import)

Recommend: Simple approach — old tokens naturally expire, admin re-imports with full JSON credential.

## Todo
- [ ] Update ISeat interface with oauth_credential subdocument
- [ ] Update Mongoose schema (replace access_token with oauth_credential)
- [ ] Update select: false and toJSON transform
- [ ] Add last_refreshed_at field
- [ ] Update OAuthCredentialMeta in shared types.ts
- [ ] Update Seat interface in shared types.ts
- [ ] Compile check: `pnpm build`

## Success Criteria
- Seat model stores oauth_credential subdocument
- Tokens excluded from API responses, metadata visible
- Shared types updated for frontend consumption
- Build passes
