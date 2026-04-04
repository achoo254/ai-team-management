# Phase 4: Frontend Updates

## Priority: Medium | Status: pending

## Overview
Update alert card for 3 new types, add metadata display. Add settings section in admin page. Clean up old type references.

## Files to Modify
- `packages/web/src/hooks/use-alerts.ts` — Update Alert interface with metadata
- `packages/web/src/hooks/use-admin.ts` — Add useSettings + useUpdateSettings hooks
- `packages/web/src/components/alert-card.tsx` — New type badges/icons, metadata display
- `packages/web/src/pages/alerts.tsx` — Minor: may need filter by type
- `packages/web/src/pages/admin.tsx` — Add alert settings section

## Implementation Steps

### 1. Update `hooks/use-alerts.ts`

Update Alert interface to match shared types:
```ts
export interface Alert {
  _id: string
  seat_id: { _id: string; email: string; label: string } | string
  type: 'rate_limit' | 'extra_credit' | 'token_failure'
  message: string
  metadata?: {
    window?: string
    pct?: number
    credits_used?: number
    credits_limit?: number
    error?: string
  }
  resolved: boolean
  resolved_by?: string
  resolved_at?: string
  created_at: string
}
```

### 2. Add settings hooks in `hooks/use-admin.ts`

```ts
export function useSettings() {
  return useQuery<{ alerts: AlertSettings }>({
    queryKey: ['settings'],
    queryFn: () => api.get('/api/settings'),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { alerts: Partial<AlertSettings> }) =>
      api.put('/api/settings', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Cập nhật cài đặt thành công')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
```

### 3. Update `alert-card.tsx`

New TYPE_CONFIG:
```ts
const TYPE_CONFIG = {
  rate_limit: { label: 'Rate Limit', variant: 'destructive', icon: TrendingUp },
  extra_credit: { label: 'Extra Credit', variant: 'warning', icon: CreditCard },
  token_failure: { label: 'Token Error', variant: 'secondary', icon: KeyRound },
}
```

Add metadata display below message:
- rate_limit: show window + pct badge
- extra_credit: show credits used/limit
- token_failure: show error code

### 4. Add settings section in `admin.tsx`

Add a card/section below existing admin buttons:
```
┌─ Cài đặt Alert ──────────────────┐
│ Rate limit threshold:  [80] %     │
│ Extra credit threshold: [80] %    │
│                       [Lưu]      │
└───────────────────────────────────┘
```

Use simple number inputs + save button. Load with `useSettings()`, save with `useUpdateSettings()`.

### 5. DB Cleanup

Add one-time migration note: run `db.alerts.deleteMany({})` in MongoDB to clear old alerts. Can be done via:
- `pnpm db:reset` if fresh start is OK
- Or manual mongo shell command

## Todo
- [ ] Update Alert interface in use-alerts.ts
- [ ] Add useSettings + useUpdateSettings in use-admin.ts
- [ ] Update alert-card.tsx — new types, icons, metadata
- [ ] Add settings section in admin.tsx
- [ ] Clean up any remaining old type references
- [ ] Run `pnpm build` to verify frontend compiles
- [ ] Manual test: verify alert cards render correctly

## Success Criteria
- Alert cards show correct badge/icon for each new type
- Metadata displayed contextually per type
- Admin can view and update alert thresholds
- No references to `high_usage` or `no_activity` in frontend code
- `pnpm build` passes with 0 errors
