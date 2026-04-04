# Phase 4: Notification Bell Component

## Overview
- **Priority**: Medium
- **Status**: pending
- **Effort**: M

## Context Links
- [Plan Overview](./plan.md)
- [Phase 1: DB Schema](./phase-01-db-schema-api.md) — depends on unread-count endpoint
- [Phase 3: Alert Feed UI](./phase-03-alert-feed-ui.md) — shares useUnreadAlertCount hook

## Key Insights
- Header component (`packages/web/src/components/header.tsx`) has simple layout: SidebarTrigger + title + ThemeToggle + UserMenu
- Bell goes between ThemeToggle and UserMenu
- No `popover` UI component exists → need to add shadcn/ui popover (or use dropdown-menu which exists)
- Dropdown-menu already exists → use it instead of adding popover (simpler, consistent)
- `useUnreadAlertCount()` polls every 60s (defined in Phase 3 hook)
- Click dropdown item → navigate to /alerts + mark as read

## Related Code Files

### Files to modify
- `packages/web/src/components/header.tsx` — add NotificationBell between ThemeToggle and UserMenu

### Files to create
- `packages/web/src/components/notification-bell.tsx` — bell icon + badge + dropdown

## Implementation Steps

### 1. Create Notification Bell (`packages/web/src/components/notification-bell.tsx`)

```
Visual design:
┌──────────────────────────────────┐
│ Claude Teams    🔔² 🌙 👤       │
└──────────────────────────────────┘
                  │
         ┌───────────────────┐
         │ Thông báo      ²  │
         ├───────────────────┤
         │ 🔴 Rate Limit     │
         │ quocdat254 · 58%  │
         │ 2 phút trước      │
         ├───────────────────┤
         │ 🔴 Rate Limit     │
         │ TK Hoàng · 63%    │
         │ 2 phút trước      │
         ├───────────────────┤
         │ 📋 Xem tất cả →   │
         └───────────────────┘
```

Component structure:
```typescript
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router";
import { useAlerts, useUnreadAlertCount, useMarkAlertsRead } from "@/hooks/use-alerts";

export function NotificationBell() {
  const navigate = useNavigate();
  const { data: unread } = useUnreadAlertCount();
  const { data: recent } = useAlerts(); // fetches latest alerts (limit 5 handled by component)
  const markRead = useMarkAlertsRead();
  const count = unread?.count ?? 0;

  // Take only 5 most recent for dropdown
  const recentAlerts = (recent?.alerts ?? []).slice(0, 5);

  function handleItemClick(alertId: string) {
    markRead.mutate([alertId]);
    navigate("/alerts");
  }

  function handleViewAll() {
    // Mark all visible as read
    if (recentAlerts.length > 0) {
      markRead.mutate(recentAlerts.map(a => a._id));
    }
    navigate("/alerts");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-2 rounded-md hover:bg-accent transition-colors">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Thông báo</span>
          {count > 0 && (
            <Badge variant="secondary" className="text-[10px]">{count}</Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recentAlerts.length === 0 ? (
          <div className="px-2 py-4 text-center text-xs text-muted-foreground">
            Không có thông báo mới
          </div>
        ) : (
          <>
            {recentAlerts.map(alert => (
              <DropdownMenuItem
                key={alert._id}
                onClick={() => handleItemClick(alert._id)}
                className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
              >
                {/* Type badge + seat label */}
                {/* Message truncated */}
                {/* Relative time */}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleViewAll} className="justify-center text-xs">
              Xem tất cả →
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

Key behaviors:
- Badge shows unread count (polls every 60s via useUnreadAlertCount)
- Dropdown shows 5 most recent alerts (compact format: type + seat + time)
- Click item → mark as read + navigate to /alerts
- "Xem tất cả" → mark visible as read + navigate to /alerts
- Empty state: "Không có thông báo mới"

### 2. Update Header (`packages/web/src/components/header.tsx`)

```typescript
import { NotificationBell } from '@/components/notification-bell'

export function Header() {
  // ... existing code ...
  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger className="lg:hidden" />
      <h1 className="flex-1 text-base font-semibold lg:text-lg">{title}</h1>

      <NotificationBell />   {/* NEW */}
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
```

### 3. Relative Time Utility

Simple relative time formatter (no library needed):
```typescript
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}
```

## Todo List
- [ ] Create notification-bell.tsx component
- [ ] Add relative time utility (inline or shared)
- [ ] Update header.tsx to include NotificationBell
- [ ] Style dropdown items with alert type badges + compact info
- [ ] Handle empty state
- [ ] Run `pnpm build` to verify compilation

## Success Criteria
- Bell icon visible in header on all pages
- Badge shows correct unread count
- Dropdown shows 5 most recent alerts in compact format
- Click item navigates to /alerts and marks as read
- "Xem tất cả" link works
- Responsive (works on mobile header too)

## Risk Assessment
- **Query overhead**: useUnreadAlertCount polls every 60s on every page → lightweight endpoint (just count query)
- **useAlerts in bell**: Shares query cache with alerts page → no duplicate requests when on /alerts
- **Dropdown z-index**: DropdownMenu from shadcn/ui handles z-index via Radix portal → no issues
