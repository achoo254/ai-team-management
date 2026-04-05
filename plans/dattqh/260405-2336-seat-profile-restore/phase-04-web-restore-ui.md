# Phase 4: Web — Restore Dialog + Hook Updates

**Priority:** Medium
**Status:** Done
**Est:** 1.5h
**Depends on:** Phase 3 (API restore flow)

## Context Links
- Seat form dialog: `packages/web/src/components/seat-form-dialog.tsx` (309 LOC)
- Seats hook: `packages/web/src/hooks/use-seats.ts`
- Shared types: `packages/shared/types.ts`

## Overview

Update `use-seats.ts` types to support restore/force-new params. Add restore choice UI in create flow when `restorable_seat` detected from preview-token. Extract restore dialog to separate component to keep file sizes manageable.

## Data Flow

```
User pastes credential JSON
  → usePreviewSeatToken (debounced)
  → API returns { ...profile, restorable_seat? }
  → if restorable_seat:
      Show restore banner in CreateMode:
        "Seat [label] đã bị xóa ngày [date]. Bạn muốn khôi phục hay tạo mới?"
        [Khôi phục] → payload: { credential_json, max_users, label, restore_seat_id }
        [Tạo mới]   → payload: { credential_json, max_users, label, force_new: true }
  → if no restorable_seat:
      Normal create flow (unchanged)

useCreateSeat → POST /api/seats
  → if response has { restorable: true } (edge case: preview missed it):
      Show same dialog
  → if response has { restored: true }:
      toast.success("Khôi phục seat thành công")
  → normal 201: toast.success("Tạo seat thành công")
```

## Related Code Files

**Modify:**
- `packages/web/src/hooks/use-seats.ts` — update types
- `packages/web/src/components/seat-form-dialog.tsx` — add restore state + delegate to new component

**Create:**
- `packages/web/src/components/seat-restore-banner.tsx` — extracted restore choice UI

## Implementation Steps

### 1. Update types in `use-seats.ts`

```typescript
// Extend PreviewTokenResponse
export interface PreviewTokenResponse {
  account: { email: string; full_name: string; has_claude_max: boolean; has_claude_pro: boolean }
  organization: { name: string; organization_type: string; rate_limit_tier: string; subscription_status: string }
  duplicate_seat_id: string | null
  restorable_seat?: {            // NEW
    _id: string
    label: string
    deleted_at: string
    has_history: boolean
  } | null
}

// Extend CreateSeatPayload
export interface CreateSeatPayload {
  credential_json: string
  max_users: number
  label?: string
  manual_mode?: boolean
  email?: string
  restore_seat_id?: string       // NEW
  force_new?: boolean            // NEW
}
```

### 2. Update `useCreateSeat` success handler

Handle both `restored: true` and normal 201:

```typescript
export function useCreateSeat() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSeatPayload) => api.post("/api/seats", body),
    onSuccess: (_data: any) => {
      qc.invalidateQueries({ queryKey: KEY })
      // Don't toast for restorable response — UI handles it
      if (_data?.restorable) return
      toast.success(_data?.restored ? "Khôi phục seat thành công" : "Tạo seat thành công")
    },
    onError: (e: Error) => toast.error(e.message),
  })
}
```

### 3. Create `seat-restore-banner.tsx`

Small component (~50 LOC) shown inside CreateMode when restorable seat detected.

```typescript
// packages/web/src/components/seat-restore-banner.tsx

interface SeatRestoreBannerProps {
  seat: { _id: string; label: string; deleted_at: string; has_history: boolean }
  onRestore: () => void
  onCreateNew: () => void
  loading?: boolean
}

export function SeatRestoreBanner({ seat, onRestore, onCreateNew, loading }: SeatRestoreBannerProps) {
  const deletedDate = new Date(seat.deleted_at).toLocaleDateString("vi-VN")

  return (
    <div className="rounded-md border border-amber-500/50 bg-amber-500/5 p-4 space-y-3">
      <div className="text-sm font-medium">Seat đã xóa trước đó</div>
      <p className="text-sm text-muted-foreground">
        Seat <strong>{seat.label}</strong> đã bị xóa ngày {deletedDate}.
        {seat.has_history && " Dữ liệu sử dụng cũ vẫn còn lưu."}
      </p>
      <p className="text-sm">Bạn muốn khôi phục (giữ dữ liệu cũ) hay tạo mới?</p>
      <div className="flex gap-2">
        <Button variant="default" size="sm" onClick={onRestore} disabled={loading}>
          {loading ? "Đang xử lý..." : "Khôi phục"}
        </Button>
        <Button variant="outline" size="sm" onClick={onCreateNew} disabled={loading}>
          Tạo mới
        </Button>
      </div>
    </div>
  )
}
```

### 4. Modify CreateMode in `seat-form-dialog.tsx`

Add state + conditional rendering:

```typescript
// In CreateMode component — new state:
const [restorableSeat, setRestorableSeat] = useState<PreviewTokenResponse['restorable_seat']>(null)

// In useEffect for profile preview — update onSuccess:
preview.mutate(rawJson.trim(), {
  onSuccess: (data) => {
    setProfile(data)
    setProfileError(null)
    setRestorableSeat(data.restorable_seat ?? null)  // NEW
  },
  // ...
})

// Reset on open/close — add:
setRestorableSeat(null)

// In JSX, after profile preview section and before label/maxUsers inputs:
{restorableSeat && !duplicate && (
  <SeatRestoreBanner
    seat={restorableSeat}
    loading={loading}
    onRestore={() => {
      if (!parsed) return
      onSubmit({
        mode: "create",
        data: {
          credential_json: rawJson.trim(),
          max_users: maxUsers,
          ...(labelOverride ? { label: labelOverride } : {}),
          restore_seat_id: restorableSeat._id,
        },
      })
    }}
    onCreateNew={() => {
      if (!parsed) return
      onSubmit({
        mode: "create",
        data: {
          credential_json: rawJson.trim(),
          max_users: maxUsers,
          ...(labelOverride ? { label: labelOverride } : {}),
          force_new: true,
        },
      })
    }}
  />
)}
```

When `restorableSeat` is present, hide the normal "Tao Seat" button (or disable it) — user must choose via banner.

```typescript
// Update canSubmit:
const canSubmit =
  parsed && !duplicate && !restorableSeat && !preview.isPending && !loading && maxUsers >= 1 && (
    manualMode ? !!manualEmail.trim() && !!labelOverride.trim() : !!profile
  )
```

### 5. Handle restorable response from useCreateSeat

Edge case: user calls POST /seats without preview (unlikely but defensive). The API returns `{ restorable: true, deleted_seat }` instead of creating.

In the page that calls `useCreateSeat` (likely `seats-page.tsx`), check the response:

```typescript
createSeat.mutate(payload, {
  onSuccess: (data: any) => {
    if (data?.restorable) {
      // Re-open dialog or show toast prompting user
      // This is a fallback — normal flow handles it via preview-token
      toast.info("Seat đã tồn tại trước đó. Vui lòng chọn khôi phục hoặc tạo mới.")
      return
    }
    closeDialog()
  },
})
```

## File Size Management

| File | Current | After changes | Action |
|------|---------|---------------|--------|
| `seat-form-dialog.tsx` | 309 LOC | ~330 LOC | OK — restore logic delegated to banner component |
| `use-seats.ts` | 130 LOC | ~140 LOC | OK |
| `seat-restore-banner.tsx` | N/A | ~50 LOC | New file |

## Todo List

- [ ] Update `PreviewTokenResponse` in `use-seats.ts` — add `restorable_seat`
- [ ] Update `CreateSeatPayload` in `use-seats.ts` — add `restore_seat_id`, `force_new`
- [ ] Update `useCreateSeat` success handler for restored response
- [ ] Create `seat-restore-banner.tsx` component
- [ ] Add `restorableSeat` state to CreateMode in `seat-form-dialog.tsx`
- [ ] Wire `restorable_seat` from preview response to banner display
- [ ] Disable "Tao Seat" button when restorable seat present
- [ ] Wire banner callbacks to `onSubmit` with restore/force_new params
- [ ] Handle edge case: restorable response from POST /seats (fallback toast)
- [ ] Typecheck: `pnpm -F @repo/web build`
- [ ] Manual test: paste token of deleted seat → see restore banner
- [ ] Manual test: click "Khoi phuc" → seat restored with history
- [ ] Manual test: click "Tao moi" → old data purged, new seat created
- [ ] Manual test: paste token of non-deleted seat → normal create flow unchanged

## Success Criteria

- Preview-token with deleted-seat email shows restore banner
- "Khoi phuc" sends `restore_seat_id`, toast confirms restoration
- "Tao moi" sends `force_new: true`, toast confirms creation
- Normal create flow (no deleted match) unchanged
- All Vietnamese labels, no mixed language
- File sizes under 200 LOC per new file

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| `seat-form-dialog.tsx` complexity growing | Restore logic extracted to `seat-restore-banner.tsx`; CreateMode stays focused |
| User confused by restore choice | Clear Vietnamese copy; show deletion date + whether history exists |
| Race: seat restored by another user between preview and submit | API returns 404 on restore attempt; FE shows error toast, user retries |

## Security Considerations

- No new auth requirements — uses existing seat create flow permissions
- `restore_seat_id` validated as ObjectId server-side
- Restored seat ownership always set to current user — no privilege escalation
