# Phase 3: Shared Types

## Overview
- **Priority:** High
- **Status:** Completed
- **Effort:** Small

Update shared TypeScript types to include ownership fields.

## Related Files
- `packages/shared/types.ts` — modify

## Implementation Steps

### 3.1 Update Seat interface

```typescript
interface Seat {
  _id: string
  email: string
  label: string
  team: 'dev' | 'mkt'
  max_users: number
  owner_id: string | null          // NEW
  owner?: { _id: string; name: string; email: string } | null  // NEW (populated)
  has_token?: boolean
  token_active?: boolean
  oauth_credential?: OAuthCredentialMeta | null
  last_fetched_at?: string | null
  last_fetch_error?: string | null
  last_refreshed_at?: string | null
  created_at: string
}
```

## Todo
- [x] Add `owner_id` and `owner` to Seat interface

## Success Criteria
- Both API and Web packages can reference owner fields without type errors
