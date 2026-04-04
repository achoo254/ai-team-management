---
phase: 4
status: done
priority: medium
depends_on: [phase-01, phase-03]
---

# Phase 4: Frontend UI

## Overview
Enhanced token dialog with JSON paste + file upload tabs, parse preview, metadata display, expiry countdown.

## Related Code Files
- **Modify:** `packages/web/src/components/seat-token-dialog.tsx`
- **Modify:** `packages/web/src/hooks/use-usage-snapshots.ts`
- **Modify:** `packages/shared/types.ts` (if not done in phase 1)

## Implementation Steps

### 1. Update `useSetSeatToken` Hook

Change mutation payload to support credential_json:

```typescript
export function useSetSeatToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { seatId: string; credential_json: string }) =>
      api.put(`/api/seats/${payload.seatId}/token`, {
        credential_json: payload.credential_json,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seats'] })
      toast.success('Đã cập nhật credential')
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
```

### 2. Rewrite `seat-token-dialog.tsx`

**Structure:**

```
Dialog
├── Header: "Credential — {seat.label}"
├── Status Section
│   ├── Badge: has_token / no_token
│   ├── Badge: Active / Inactive
│   ├── Token expiry: countdown or "Expired"
│   └── Last refreshed: relative time
├── Metadata Section (if has credential)
│   ├── Scopes: badge list
│   ├── Subscription: team/pro/etc
│   └── Rate Limit Tier
├── Error display (if last_fetch_error)
├── Input Tabs
│   ├── Tab "Paste JSON"
│   │   ├── Textarea (monospace, 6 rows)
│   │   └── Parse preview (shows extracted fields)
│   └── Tab "Upload File"
│       ├── File input (.json)
│       └── Parse preview
└── Footer
    ├── Remove Token button (destructive)
    └── Save button
```

**Key behaviors:**

1. **JSON parsing** — Client-side parse: try `JSON.parse(input)`, look for `claudeAiOauth` key, extract and show preview:
   - Access token prefix: `sk-ant-oat01-...` (first 20 chars + `...`)
   - Refresh token: present/absent
   - Expires at: formatted date + "in X hours"
   - Scopes count
   - Subscription type

2. **File upload** — `<input type="file" accept=".json">` + FileReader:
   ```typescript
   const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0]
     if (!file) return
     const reader = new FileReader()
     reader.onload = (ev) => {
       const text = ev.target?.result as string
       setRawJson(text)
       tryParseJson(text)
     }
     reader.readAsText(file)
   }
   ```

3. **Parse preview** — Show parsed credential metadata before saving. Validate: must have at least access_token.

4. **Expiry countdown** — Display time remaining until expires_at. Use relative formatting:
   - `> 1h`: "Hết hạn sau X giờ"
   - `< 1h`: "Hết hạn sau X phút" (warning color)
   - `expired`: "Đã hết hạn" (red)
   - `null`: "Không có thông tin hết hạn"

5. **Metadata display** — When seat has oauth_credential from API:
   - Scopes as small badges
   - Subscription type text
   - Rate limit tier text

### 3. Tab Implementation

Use simple state toggle (no need for heavy tab library):

```typescript
const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste')
```

Two buttons styled as tabs, conditionally render textarea or file input.

### 4. Save Flow

On save:
1. Take raw JSON string (from textarea or file read)
2. Send as `{ credential_json: rawJson }` to API
3. Server handles parsing and encryption

## Todo
- [ ] Update useSetSeatToken hook payload type
- [ ] Rewrite seat-token-dialog with tabs (paste/upload)
- [ ] Add JSON parse preview component
- [ ] Add file upload handler
- [ ] Add expiry countdown display
- [ ] Add metadata display section (scopes, subscription, rate limit)
- [ ] Compile check: `pnpm build`

## Success Criteria
- Both paste and upload work
- Parse preview shows extracted fields before save
- Metadata visible on dialog when seat has credential
- Expiry countdown updates
- Build passes
