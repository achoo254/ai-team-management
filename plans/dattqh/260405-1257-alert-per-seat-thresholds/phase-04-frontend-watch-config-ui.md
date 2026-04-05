# Phase 04 — Frontend Per-Seat Watch Config UI

**Priority:** P0 | **Status:** completed | **Depends on:** Phase 02

## Context

- Seats page: `packages/web/src/pages/seats.tsx`
- Seat card/item component (discover via Grep, likely in `packages/web/src/components/`)
- Hooks dir: `packages/web/src/hooks/`
- Pattern reference: existing modals/popovers in `packages/web/src/components/`

## Requirements

### Primary UX: Watch Config on Seat Card

Each seat card shows:
- **Not watching**: button "👁 Watch" → click opens inline config with defaults (5h=90, 7d=85) → Save
- **Watching**: small badge "Watching · 5h 90% · 7d 85%" + hover shows edit/unwatch icons
  - Click badge → opens popover to edit thresholds
  - Unwatch icon → confirm → DELETE

### Secondary UX: Watched Seats Summary

In the `/settings` page (near AlertSettingsForm), show a compact list:
```
┌─ Seats đang theo dõi (3) ───────────────┐
│ Seat Alpha    5h 90% · 7d 85%   [Edit] │
│ Seat Beta     5h 80% · 7d 70%   [Edit] │
│ Seat Gamma    5h 95% · 7d 90%   [Edit] │
└──────────────────────────────────────────┘
```
Click Edit → same threshold popover.

### Threshold Editor Popover

```
┌─ Watch Seat Alpha ─────────────┐
│                                 │
│ Ngưỡng 5 giờ                    │
│ [━━━━━━●━━] 90%                 │
│                                 │
│ Ngưỡng 7 ngày                   │
│ [━━━━━●━━━] 85%                 │
│                                 │
│ ℹ Theo dõi seat cũng bao gồm   │
│   báo cáo usage hàng tuần       │
│                                 │
│ [Hủy]  [Lưu]                   │
└─────────────────────────────────┘
```

Input: Slider 1-100 + numeric input (dual control). Uses existing shadcn/ui components (Slider if available, else number input + native range).

Small hint at bottom clarifies that watching triggers weekly report inclusion too.

### Empty State

If user has 0 watched seats AND `alert_settings.enabled = true`:
- Banner on dashboard + settings page:
  > ⚠ Bạn chưa theo dõi seat nào — sẽ không nhận alert usage **và báo cáo usage hàng tuần**. [Watch seats →]

**Context**: `watched_seats` serves dual purpose — controls both alert scope and weekly report scope. UI must communicate this so users understand watching = full notification opt-in for that seat.

## New Components

| Component | File | Purpose |
|---|---|---|
| `WatchSeatButton` | `packages/web/src/components/watch-seat-button.tsx` | Button on seat card, toggles watch state, opens editor |
| `WatchThresholdPopover` | `packages/web/src/components/watch-threshold-popover.tsx` | Popover content with 2 sliders + save/cancel |
| `WatchedSeatsSummary` | `packages/web/src/components/watched-seats-summary.tsx` | Compact list for settings page |
| `WatchEmptyStateBanner` | `packages/web/src/components/watch-empty-state-banner.tsx` | Empty state warning |

Each file < 150 LOC.

## New Hooks

File: `packages/web/src/hooks/use-watched-seats.ts`

```ts
export function useWatchSeat() { /* POST */ }
export function useUpdateWatchedSeat() { /* PUT */ }
export function useUnwatchSeat() { /* DELETE */ }
```

All invalidate `['user-settings']` query key on success.

## Related Files

**Modify:**
- `packages/web/src/pages/seats.tsx` — integrate WatchSeatButton on each seat card
- `packages/web/src/pages/settings.tsx` (or wherever AlertSettingsForm renders) — add WatchedSeatsSummary + empty state banner
- `packages/web/src/pages/dashboard.tsx` — add empty state banner (conditional)

**Create:**
- 4 components listed above
- `packages/web/src/hooks/use-watched-seats.ts`

## Implementation Steps

### Step 1: Create hook
Mutation hooks wrapping `POST/PUT/DELETE /api/user/watched-seats`. Use existing `api-client.ts` pattern.

### Step 2: Build WatchThresholdPopover
- Props: `{ seatId, seatLabel, current?: { threshold_5h_pct, threshold_7d_pct }, onClose }`
- 2 sliders (or number inputs): state controlled
- Save → call `useWatchSeat` (if new) or `useUpdateWatchedSeat` (if existing)
- Cancel → close

### Step 3: Build WatchSeatButton
- Read current watch state from `useUserSettings` (`watched_seats` array)
- Not watching: small ghost button with eye icon
- Watching: primary-tinted badge with "5h X% · 7d Y%" label + edit icon
- Both open `WatchThresholdPopover` via shadcn Popover
- Unwatch via dropdown menu item or X icon on badge

### Step 4: Build WatchedSeatsSummary
- Read `watched_seats` from settings query
- Render compact table/list
- Each row has Edit button opening popover

### Step 5: Build WatchEmptyStateBanner
- Conditional: `watched_seats.length === 0 && alert_settings.enabled`
- Dismissible (localStorage `dismissed_watch_empty_banner_v1`)
- Link to /seats

### Step 6: Integrate on Seats page
- Locate seat card component in seats.tsx (or its child)
- Add `<WatchSeatButton seatId={seat._id} seatLabel={seat.label ?? seat.email} />` in card actions

### Step 7: Integrate on Settings page
- Render `<WatchedSeatsSummary />` below `<AlertSettingsForm />`
- Render `<WatchEmptyStateBanner />` at top

### Step 8: Integrate on Dashboard
- Render `<WatchEmptyStateBanner />` above existing dashboard content when conditions met

### Step 9: Lint + visual QA
- `pnpm lint`
- Manual test: watch seat, edit thresholds, unwatch, verify API calls in Network tab
- Check responsive layout on mobile (seat cards)
- Check dark mode (Tailwind v4 + shadcn tokens)

## Todo

- [ ] `use-watched-seats.ts` hook
- [ ] `WatchThresholdPopover` component
- [ ] `WatchSeatButton` component
- [ ] `WatchedSeatsSummary` component
- [ ] `WatchEmptyStateBanner` component
- [ ] Integrate on seats page
- [ ] Integrate on settings page
- [ ] Integrate on dashboard
- [ ] Lint + visual QA (light + dark, mobile + desktop)

## Success Criteria

- User can watch/unwatch seat from seats page in ≤ 2 clicks.
- Threshold editor intuitive: slider + number feedback.
- Settings page shows all watched seats with thresholds at a glance.
- Empty state banner guides new users.
- Optimistic UI: thresholds update instantly, revert on error.
- Works on mobile (≥ 375px) and dark mode.

## UI/UX Design Decisions

| Decision | Rationale |
|---|---|
| Inline on seat card (not modal) | Keep context: user evaluating seat usage sees watch control right there |
| Slider + number dual input | Slider for intuition, number for precision |
| Badge with thresholds visible | No need to click to see current config |
| Default 90/85 | Conservative: alerts early enough without being noisy |
| Dismissible empty banner | Non-intrusive onboarding, respects returning users |
| No multi-select bulk watch | YAGNI — user has ≤ 20 seats, per-seat UX fine |

## Risks

- **Popover overlap on small seat cards**: Test on mobile; fallback to Drawer on narrow viewports.
- **Race: edit while cron fires**: Acceptable — next cron tick picks up new thresholds.
- **User forgets to save after changing sliders**: Show "unsaved" dirty indicator + confirm on close.

## Security

- All mutations authenticated (cookie/Bearer).
- Backend validates seat access; UI just reflects.
- No sensitive data displayed in popover.
