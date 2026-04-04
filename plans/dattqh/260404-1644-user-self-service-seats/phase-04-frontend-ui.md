# Phase 4: Frontend UI

## Overview
- **Priority:** High
- **Status:** Completed
- **Effort:** Medium

Update seats page to show ownership context, group seats by relationship, add per-seat export, and admin transfer UI.

## Related Files
- `packages/web/src/pages/seats.tsx` — modify
- `packages/web/src/components/seat-card.tsx` — modify
- `packages/web/src/hooks/use-seats.ts` — modify
- `packages/web/src/components/seat-form-dialog.tsx` — minor (no changes expected)
- `packages/web/src/components/seat-token-dialog.tsx` — minor (no changes expected)

## Implementation Steps

### 4.1 Update use-seats.ts hooks

Add new hooks/functions:

```typescript
// Per-seat credential export
export async function exportSeatCredential(seatId: string) {
  const res = await api.get(`/api/seats/${seatId}/credentials/export`)
  // Download as JSON file: credential-{seat_label}-{date}.json
}

// Transfer ownership (admin)
export function useTransferOwnership() {
  return useMutation({
    mutationFn: ({ seatId, newOwnerId }: { seatId: string; newOwnerId: string }) =>
      api.put(`/api/seats/${seatId}/transfer`, { new_owner_id: newOwnerId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seats'] })
  })
}
```

Update `Seat` interface in hook to include `owner_id` and `owner` fields (or import from shared).

### 4.2 Update seats.tsx page — grouped sections

Replace flat grid with 3 sections:

```
┌─────────────────────────────────────┐
│ 🏠 My Seats (owner_id === me)       │
│ [Card] [Card] [Card]               │
├─────────────────────────────────────┤
│ 👥 Assigned Seats (in seat.users)   │
│ [Card] [Card]                       │
├─────────────────────────────────────┤
│ 📋 Other Seats (view only)          │
│ [Card] [Card] [Card] [Card]        │
└─────────────────────────────────────┘
```

Logic:
```typescript
const mySeats = seats.filter(s => s.owner_id === currentUser._id)
const assignedSeats = seats.filter(s => 
  s.owner_id !== currentUser._id && 
  s.users?.some(u => u.id === currentUser._id)
)
const otherSeats = seats.filter(s => 
  s.owner_id !== currentUser._id && 
  !s.users?.some(u => u.id === currentUser._id)
)
```

Admin sees all seats in all sections but with full controls everywhere.

"Add Seat" button: visible to ALL authenticated users (not just admin).

### 4.3 Update seat-card.tsx — ownership context

Add to SeatCard:
- **Owner badge:** Show owner name/email below seat label
- **Conditional actions:** Show edit/delete/credential/assign buttons only for owner + admin
- **Per-seat export button:** Download icon on credential section (owner + admin)
- **Transfer button:** Admin-only, opens user picker to transfer ownership

Props change:
```typescript
interface SeatCardProps {
  seat: Seat
  users: User[]
  currentUser: AuthUser     // NEW — to check ownership
  isAdmin: boolean
  onEdit: () => void
  onDelete: () => void
  onAssign: (userId: string) => void
  onUnassign: (userId: string) => void
  onExportCredential: () => void    // NEW
  onTransfer?: (newOwnerId: string) => void  // NEW (admin only)
}
```

Visual indicator:
- "My seat" badge if owner
- Owner name if not owner

### 4.4 Admin transfer ownership UI

Simple approach: in seat card dropdown menu → "Transfer Ownership" → opens dialog with user select → confirm.

No new component needed — inline in SeatCard's dropdown with a simple confirm dialog.

## Todo
- [x] Add `exportSeatCredential()` function to use-seats.ts
- [x] Add `useTransferOwnership()` hook to use-seats.ts
- [x] Update Seat interface in hooks
- [x] Refactor seats.tsx — 3-section layout
- [x] "Add Seat" button visible to all users
- [x] Update seat-card.tsx — owner badge + conditional actions
- [x] Per-seat export button on card
- [x] Admin transfer ownership in card dropdown
- [x] Test responsive layout with sections

## Success Criteria
- User sees own seats prominently at top
- User can create seat via "Add Seat" button
- Owner sees full action buttons on own seats
- Non-owner sees view-only cards
- Admin sees all controls on all seats
- Per-seat export downloads single credential JSON
- Transfer ownership works for admin

## UX Considerations
- Empty sections: hide section header if no seats in category
- Loading states: skeleton cards per section
- Section collapse: optional, nice-to-have
