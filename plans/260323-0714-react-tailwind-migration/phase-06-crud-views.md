# Phase 6: CRUD Views (Seats, Teams, Alerts, Admin, Usage Log)

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 3 days
- **Description:** 5 CRUD views with modals, forms, admin gating. All mobile responsive.
- **Can parallel with:** Phase 5, 7

## Key Insights
- 5 views share similar patterns: list + create/edit modal + delete confirm
- shadcn Dialog = modals on desktop, Sheet (bottom drawer) on mobile
- TanStack Query mutations for optimistic updates
- Vietnamese IME: use uncontrolled inputs or onChange (not onInput)
- Admin-only actions: create, edit, delete — hidden for regular users

## Requirements

### Functional
- **Seats**: List cards, create/edit modal, assign/unassign users, delete with confirm
- **Teams**: List cards, create/edit modal, delete (empty-check)
- **Alerts**: List with resolved/unresolved filter, resolve button (admin)
- **Admin**: User table, create/edit modal, delete, bulk active toggle, send report, check alerts
- **Log Usage**: Week table, navigate weeks, bulk save percentages

### Non-functional
- Optimistic updates on mutations
- Form validation (required fields, email format)
- Toast notifications for success/error
- Mobile: modals → bottom sheets, tables → card lists

## Related Code Files

### Files to Create

**Seats:**
- `app/(dashboard)/seats/page.tsx`
- `components/seats/seat-card.tsx`
- `components/seats/seat-form-dialog.tsx`
- `components/seats/seat-assign-dialog.tsx`
- `hooks/use-seats.ts`

**Teams:**
- `app/(dashboard)/teams/page.tsx`
- `components/teams/team-card.tsx`
- `components/teams/team-form-dialog.tsx`
- `hooks/use-teams.ts`

**Alerts:**
- `app/(dashboard)/alerts/page.tsx`
- `components/alerts/alert-card.tsx`
- `hooks/use-alerts.ts`

**Admin:**
- `app/(dashboard)/admin/page.tsx`
- `components/admin/user-table.tsx`
- `components/admin/user-form-dialog.tsx`
- `hooks/use-admin.ts`

**Usage Log:**
- `app/(dashboard)/log-usage/page.tsx`
- `components/usage-log/week-table.tsx`
- `components/usage-log/week-navigator.tsx`
- `hooks/use-usage-log.ts`

**Shared:**
- `components/shared/confirm-dialog.tsx`
- `components/shared/empty-state.tsx`
- `lib/api-client.ts` — Typed fetch wrapper

## Implementation Steps

### 1. Shared Components First

**api-client.ts** — Typed fetch wrapper
```typescript
class ApiClient {
  async get<T>(url: string): Promise<T>
  async post<T>(url: string, body?: unknown): Promise<T>
  async put<T>(url: string, body?: unknown): Promise<T>
  async patch<T>(url: string, body?: unknown): Promise<T>
  async delete<T>(url: string, body?: unknown): Promise<T>
  // Auto 401 → redirect /login
}
export const api = new ApiClient()
```

**confirm-dialog.tsx** — Reusable confirm/cancel dialog
- Title, description, confirm button (destructive variant)
- Used by all delete actions

### 2. Seats View (6 endpoints)

- **Page**: Grid of seat cards + "Add Seat" button (admin)
- **Seat Card**: Email, label, team badge, assigned users list, max_users
  - Admin actions: Edit, Delete, Assign User
- **Seat Form**: email, label, team select, max_users input
- **Assign Dialog**: User select dropdown, filtered by unassigned users
- **Mutations**: createSeat, updateSeat, deleteSeat, assignUser, unassignUser
- **Mobile**: Single column cards, full-width modals

### 3. Teams View (4 endpoints)

- **Page**: Grid of team cards + "Add Team" button (admin)
- **Team Card**: Name, label, color swatch, user count, seat count
  - Admin actions: Edit, Delete (blocked if has users)
- **Team Form**: name, label, color picker
- **Mobile**: Single column cards

### 4. Alerts View (2 endpoints)

- **Page**: Filter tabs (All/Unresolved/Resolved) + alert list
- **Alert Card**: Type badge (high_usage/no_activity), seat, message, timestamp
  - Admin: Resolve button
  - Resolved: show resolver name + timestamp
- **Mobile**: Full-width cards, filter as horizontal scroll tabs

### 5. Admin View (7 endpoints)

- **Page**: User table + action buttons (Send Report, Check Alerts, Bulk Toggle)
- **User Table**: Name, email, team, role badge, active status, seat assignment
  - Actions: Edit, Delete
- **User Form**: name, email, team select, role select, active toggle
- **Bulk Active**: Toggle all users active/inactive (except self)
- **Send Report**: Button with 60s cooldown indicator
- **Check Alerts**: Button to trigger alert check
- **Mobile**: Card list instead of table, action buttons in dropdown

### 6. Usage Log View (2 endpoints)

- **Page**: Week navigator + usage table
- **Week Navigator**: Previous/next week buttons, current week display (Mon-Sun)
- **Usage Table**: Rows per seat — seat email, all_pct input, sonnet_pct input
  - Editable number inputs (0-100)
  - Save button for bulk submit
  - Admin-only editing
- **Vietnamese IME**: Use `<input type="number">` — no IME issue for numbers
- **Mobile**: Stacked card layout per seat with inline inputs

## Todo List

- [ ] Create lib/api-client.ts (typed fetch wrapper)
- [ ] Create confirm-dialog.tsx (shared)
- [ ] Create empty-state.tsx (shared)
- [ ] Create seats view (page + card + form + assign dialog + hooks)
- [ ] Create teams view (page + card + form + hooks)
- [ ] Create alerts view (page + card + hooks)
- [ ] Create admin view (page + table + form + hooks)
- [ ] Create log-usage view (page + table + navigator + hooks)
- [ ] Add toast notifications for all mutations
- [ ] Test all CRUD operations end-to-end
- [ ] Test mobile responsive for all 5 views

## Success Criteria
- All CRUD operations work identically to current version
- Admin-only actions hidden for regular users
- Form validation prevents invalid submissions
- Toast feedback on success/error
- Mobile: bottom sheets for modals, card layouts for tables

## Risk Assessment
- **Many components**: Keep each file focused, < 100 lines
- **Form state**: Use React Hook Form or shadcn form primitives — avoid complex useState
- **Vietnamese IME**: Not an issue for number inputs. Text inputs (name, email) use standard onChange.

## Next Steps
→ Phase 7: Schedule & DnD (parallel)
