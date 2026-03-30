---
phase: 5
priority: medium
status: completed
effort: M
---

# Phase 5: UI Component Tests

## Overview

Test React components using `@testing-library/react`. Focus on user interaction, not implementation details.

## Environment

- `jsdom` environment
- Mock hooks (return test data) — don't test API layer again
- `@testing-library/user-event` for interactions

## Components to Test

### Priority 1: Forms & Dialogs (user input)

| Component | File | Key Tests |
|-----------|------|-----------|
| `seat-form-dialog` | `tests/ui/seat-form-dialog.test.tsx` | Renders fields, validates required, submits |
| `team-form-dialog` | `tests/ui/team-form-dialog.test.tsx` | CRUD form, color picker |
| `user-form-dialog` | `tests/ui/user-form-dialog.test.tsx` | Role select, team select |
| `confirm-dialog` | `tests/ui/confirm-dialog.test.tsx` | Confirm/cancel actions |

### Priority 2: Data Display

| Component | File | Key Tests |
|-----------|------|-----------|
| `seat-card` | `tests/ui/seat-card.test.tsx` | Renders seat info, user list |
| `team-card` | `tests/ui/team-card.test.tsx` | Renders team info |
| `alert-card` | `tests/ui/alert-card.test.tsx` | Renders alert, resolve button |
| `user-table` | `tests/ui/user-table.test.tsx` | Renders rows, edit/delete actions |
| `usage-table` | `tests/ui/usage-table.test.tsx` | Renders usage data |

### Priority 3: Dashboard Charts

| Component | File | Key Tests |
|-----------|------|-----------|
| `stat-cards` | `tests/ui/stat-cards.test.tsx` | Renders stats correctly |
| `team-pie-chart` | `tests/ui/team-pie-chart.test.tsx` | Renders with data |
| `usage-bar-chart` | `tests/ui/usage-bar-chart.test.tsx` | Renders bars |

### Priority 4: Layout

| Component | File | Key Tests |
|-----------|------|-----------|
| `app-sidebar` | `tests/ui/app-sidebar.test.tsx` | Nav items render, active state |
| `header` | `tests/ui/header.test.tsx` | User menu, theme toggle |

## Mock Strategy

- Mock custom hooks (`vi.mock("@/hooks/use-seats")`) to return test data
- Mock `next/navigation` (`useRouter`, `usePathname`)
- Don't mock shadcn/ui primitives — let them render

## Files to Create

- `tests/ui/seat-form-dialog.test.tsx`
- `tests/ui/team-form-dialog.test.tsx`
- `tests/ui/user-form-dialog.test.tsx`
- `tests/ui/confirm-dialog.test.tsx`
- `tests/ui/seat-card.test.tsx`
- `tests/ui/team-card.test.tsx`
- `tests/ui/alert-card.test.tsx`
- `tests/ui/user-table.test.tsx`
- `tests/ui/stat-cards.test.tsx`
- `tests/ui/app-sidebar.test.tsx`

## Success Criteria

- [ ] Form validation tested
- [ ] User interactions (click, type, select) tested
- [ ] Error/empty states render correctly
- [ ] No real API calls from UI tests
