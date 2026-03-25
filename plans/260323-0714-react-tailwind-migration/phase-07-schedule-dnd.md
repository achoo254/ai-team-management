# Phase 7: Schedule & Drag-Drop

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 2 days
- **Description:** Schedule grid với @dnd-kit cho desktop drag-drop và mobile touch. Day-by-day mobile view.
- **Can parallel with:** Phase 5, 6

## Key Insights
- Current: HTML5 native DnD — 2 modes: member→cell (assign), cell→cell (swap)
- @dnd-kit: unified API cho mouse + touch + keyboard, accessible
- Schedule grid: seats × (7 days × 2 slots) = matrix
- Admin-only: drag-drop, assign, delete. Regular users: view only.
- Mobile: full grid too wide → switch to day-by-day tab view
- Unique constraint: { seat_id, day_of_week, slot } — 1 person per cell

## Requirements

### Functional
- Schedule grid: rows = seats, columns = day × slot (morning/afternoon)
- Member sidebar (admin): draggable user list → drop onto grid cells
- Cell-to-cell drag: move/swap schedule entries
- Assign: drop member onto empty cell → POST /api/schedules/assign
- Swap: drag cell to another cell → PATCH /api/schedules/swap
- Delete: remove entry from cell → DELETE /api/schedules/entry
- Clear all: bulk delete → DELETE /api/schedules/all (admin)
- Mobile: tab per day, list of slots with assigned users

### Non-functional
- Smooth 60fps drag animations
- Touch sensors with 250ms delay (prevent accidental drag on scroll)
- Visual feedback: drag overlay, drop indicator
- Accessible: keyboard navigation support

## Related Code Files

### Files to Create
- `app/(dashboard)/schedule/page.tsx`
- `components/schedule/schedule-grid.tsx` — Desktop grid with DnD
- `components/schedule/schedule-cell.tsx` — Single cell (droppable)
- `components/schedule/member-sidebar.tsx` — Draggable member list (admin)
- `components/schedule/day-tab-view.tsx` — Mobile day-by-day view
- `components/schedule/draggable-member.tsx` — Draggable member chip
- `components/schedule/drag-overlay-content.tsx` — Custom drag overlay
- `hooks/use-schedules.ts` — TanStack Query hooks + mutations

## Architecture

### Desktop Layout
```
┌──────────────────────────────────────────────────┬──────────┐
│                 Schedule Grid                     │ Members  │
│        Mon AM │ Mon PM │ Tue AM │ Tue PM │ ...   │          │
│ Seat1: [User] │ [User] │ [    ] │ [User] │       │ ○ User A │
│ Seat2: [    ] │ [User] │ [User] │ [    ] │       │ ○ User B │
│ Seat3: [User] │ [    ] │ [    ] │ [User] │       │ ○ User C │
└──────────────────────────────────────────────────┴──────────┘
```

### Mobile Layout
```
┌─────────────────────────┐
│ [Mon] Tue  Wed  Thu ... │  day tabs (horizontal scroll)
├─────────────────────────┤
│ Seat 1                  │
│  Morning: User A    [×] │
│  Afternoon: (empty) [+] │
├─────────────────────────┤
│ Seat 2                  │
│  Morning: (empty)   [+] │
│  Afternoon: User B  [×] │
└─────────────────────────┘
```

### DnD Flow
```
@dnd-kit setup:
├── DndContext (provider)
│   ├── SortableContext (not needed — no sorting)
│   ├── Draggable items:
│   │   ├── Member chips (sidebar) — type: 'member'
│   │   └── Filled cells (grid) — type: 'cell'
│   ├── Droppable areas:
│   │   └── Grid cells — accept both types
│   └── DragOverlay — custom preview
│
On drop:
├── member → empty cell → POST /assign
├── member → filled cell → confirm replace? → DELETE + POST
├── cell → empty cell → PATCH /swap (move)
└── cell → filled cell → PATCH /swap (swap)
```

## Implementation Steps

1. **Create hooks/use-schedules.ts**
   ```typescript
   export function useSchedules(seatId?: string) {
     return useQuery({ queryKey: ['schedules', seatId], queryFn: ... })
   }
   export function useAssignSchedule() {
     return useMutation({ mutationFn: ..., onSuccess: invalidate })
   }
   export function useSwapSchedule() { ... }
   export function useDeleteEntry() { ... }
   export function useClearAll() { ... }
   ```

2. **Create schedule-grid.tsx** — Desktop DnD grid
   - DndContext with mouse + touch sensors
   - Touch sensor: activationConstraint `{ delay: 250, tolerance: 5 }`
   - Grid: CSS grid, seats as rows, day-slots as columns
   - Each cell = Droppable with unique ID: `${seatId}-${day}-${slot}`
   - onDragEnd handler: determine action from active/over data

3. **Create schedule-cell.tsx** — Individual grid cell
   - Empty: droppable target, show "+" on hover
   - Filled: draggable + droppable, show user name + team color
   - Admin: show delete button on hover
   - Non-admin: no drag handles, view only

4. **Create member-sidebar.tsx** — Admin member list
   - List all users with team badges
   - Each user = Draggable with data: `{ type: 'member', userId, userName }`
   - Filter by team (optional)
   - Desktop only — hidden on mobile

5. **Create draggable-member.tsx** — Draggable chip component
   - User name + team color dot
   - Cursor: grab/grabbing states

6. **Create drag-overlay-content.tsx** — Custom overlay during drag
   - Shows user name chip following cursor/finger
   - Semi-transparent background

7. **Create day-tab-view.tsx** — Mobile alternative
   - Horizontal scrollable day tabs (Mon-Sun)
   - Selected day shows list of seats with morning/afternoon slots
   - Each slot: user name or "Empty"
   - Admin: [+] button to assign (opens user picker dialog), [×] to remove
   - No drag-drop on mobile — use button-based assign/remove

8. **Create schedule page** `app/(dashboard)/schedule/page.tsx`
   - Desktop (lg+): schedule-grid + member-sidebar
   - Mobile (<lg): day-tab-view
   - Responsive switch via Tailwind `hidden lg:block` / `lg:hidden`
   - "Clear All" button (admin, with confirm dialog)

## Todo List

- [ ] Create hooks/use-schedules.ts (query + 4 mutations)
- [ ] Create schedule-grid.tsx (DndContext + grid layout)
- [ ] Create schedule-cell.tsx (draggable + droppable)
- [ ] Create member-sidebar.tsx (draggable member list)
- [ ] Create draggable-member.tsx + drag-overlay-content.tsx
- [ ] Create day-tab-view.tsx (mobile alternative)
- [ ] Create schedule page with responsive desktop/mobile switch
- [ ] Test desktop: member→cell assign, cell→cell swap
- [ ] Test mobile: button-based assign/remove
- [ ] Test touch interactions on tablet

## Success Criteria
- Desktop drag-drop works: assign + swap + move
- Mobile day-tab view works: assign + remove via buttons
- Touch sensors prevent accidental drags during scroll
- Schedule data persists correctly (same as current)
- Admin-only actions properly gated
- Smooth animations, no jank

## Risk Assessment
- **@dnd-kit bundle size**: ~30KB — acceptable
- **Touch vs scroll conflict**: Use delay activation constraint (250ms hold to start drag)
- **Mobile DnD complexity**: Avoid DnD on mobile entirely — use button-based UI instead. Simpler, more reliable.
- **Cell swap edge case**: If both cells filled → server handles swap atomically

## Next Steps
→ Phase 8: Mobile polish, cron & deploy
