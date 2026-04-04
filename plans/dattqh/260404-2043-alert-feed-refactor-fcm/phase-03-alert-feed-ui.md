# Phase 3: Alert Feed UI Refactor

## Overview
- **Priority**: High (main user-facing change)
- **Status**: pending
- **Effort**: L

## Context Links
- [Plan Overview](./plan.md)
- [Phase 1: DB Schema](./phase-01-db-schema-api.md) — depends on new API endpoints

## Key Insights
- Current UI: 3 tabs (All/Unresolved/Resolved) + AlertCard with resolve button → replace entirely
- Only 3/6 alert types have UI config (`TYPE_CONFIG` in alert-card.tsx) → add all 6
- AlertCard MetadataInfo only handles rate_limit, extra_credit, token_failure → add remaining 3
- Expandable card: click to show inline usage detail per alert type
- Date grouping: Today / Yesterday / Earlier sections
- Admin sees all, member sees only watched_seat_ids (API handles filtering)
- No popover component exists → needed for notification bell (Phase 4), not this phase

## Related Code Files

### Files to modify
- `packages/web/src/pages/alerts.tsx` — complete rewrite
- `packages/web/src/components/alert-card.tsx` — complete rewrite (expandable + all 6 types)
- `packages/web/src/hooks/use-alerts.ts` — update types, remove resolve, add mark-read

### Files to create
- `packages/web/src/components/alert-feed-filters.tsx` — filter bar component (type, seat)

## Implementation Steps

### 1. Rewrite Alert Hook (`packages/web/src/hooks/use-alerts.ts`)

```typescript
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface Alert {
  _id: string;
  seat_id: { _id: string; email: string; label: string } | string;
  type: AlertType;
  message: string;
  metadata?: AlertMetadata;
  read_by?: string[];
  created_at: string;
}

type AlertType = 'rate_limit' | 'extra_credit' | 'token_failure'
  | 'usage_exceeded' | 'session_waste' | '7d_risk';

// Main feed query with optional filters
export function useAlerts(filters?: { type?: string; seat?: string }) {
  const params = new URLSearchParams()
  if (filters?.type) params.set('type', filters.type)
  if (filters?.seat) params.set('seat', filters.seat)
  const qs = params.toString() ? `?${params}` : ''

  return useQuery<{ alerts: Alert[]; has_more: boolean }>({
    queryKey: ["alerts", filters],
    queryFn: () => api.get(`/api/alerts${qs}`),
  });
}

// Unread count for bell badge
export function useUnreadAlertCount() {
  return useQuery<{ count: number }>({
    queryKey: ["alerts", "unread-count"],
    queryFn: () => api.get("/api/alerts/unread-count"),
    refetchInterval: 60_000, // poll every 60s
  });
}

// Mark alerts as read
export function useMarkAlertsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertIds: string[]) =>
      api.post("/api/alerts/mark-read", { alert_ids: alertIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

// Remove useResolveAlert entirely
```

### 2. Rewrite Alerts Page (`packages/web/src/pages/alerts.tsx`)

```
Layout:
┌─────────────────────────────────────┐
│ Cảnh báo                            │
├─────────────────────────────────────┤
│ Filter: [Type ▼] [Seat ▼]          │
├─────────────────────────────────────┤
│ Hôm nay                            │
│ ┌─ AlertCard (expandable) ────────┐ │
│ │ 🔴 RATE LIMIT  quocdat254      │ │
│ │ 58% usage (7d window)          │ │
│ │ 7d | 58% | 20:30               │ │
│ └─────────────────────────────────┘ │
│ ┌─ AlertCard (expanded) ──────────┐ │
│ │ 🔴 RATE LIMIT  TK Hoàng   ▲   │ │
│ │ 63% usage (5h window)          │ │
│ │ ┌─ Expanded Detail ──────────┐ │ │
│ │ │ 5h: ███████▓░░ 63%        │ │ │
│ │ │ 7d: █████▓░░░░ 58%        │ │ │
│ │ │ Son:████░░░░░░ 42%        │ │ │
│ │ │ Opus:███░░░░░░ 31%        │ │ │
│ │ │ Reset: ~4h 22m             │ │ │
│ │ └────────────────────────────┘ │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Hôm qua                            │
│ ┌─ AlertCard ─────────────────────┐ │
│ │ ...                             │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

Key behaviors:
- `useAlerts(filters)` fetches feed sorted by created_at DESC
- Group alerts by date: Today / Yesterday / Earlier (date header dividers)
- Filters: type dropdown (all 6 types) + seat dropdown (from user's watched seats or all for admin)
- Mark alerts as read on mount (visible alerts auto-marked)
- Empty state: Bell icon + "Không có cảnh báo"

### 3. Rewrite Alert Card (`packages/web/src/components/alert-card.tsx`)

Expand TYPE_CONFIG to all 6 types:
```typescript
const TYPE_CONFIG = {
  rate_limit:      { label: "Rate Limit",      variant: "destructive", icon: TrendingUp },
  extra_credit:    { label: "Extra Credit",     variant: "secondary",  icon: CreditCard },
  token_failure:   { label: "Token Error",      variant: "outline",    icon: KeyRound },
  usage_exceeded:  { label: "Vượt Budget",      variant: "destructive", icon: AlertTriangle },
  session_waste:   { label: "Lãng phí",         variant: "secondary",  icon: Clock },
  '7d_risk':       { label: "7d Risk",          variant: "destructive", icon: TrendingUp },
}
```

Expandable card:
- Click anywhere on card → toggle expanded state (local useState)
- Collapsed: type badge + seat label + message + timestamp (compact)
- Expanded: full metadata display per type

MetadataInfo expanded content per type:
- **rate_limit**: All 4 session progress bars (5h/7d/sonnet/opus) + resets_at countdown
- **extra_credit**: Credits used/limit + percentage progress bar
- **token_failure**: Full error message + "Cần re-import credential"
- **usage_exceeded**: User name + delta vs budget progress bar + session type
- **session_waste**: Duration + usage delta + "Cân nhắc rút ngắn session"
- **7d_risk**: Current 7d% + projected% + remaining sessions count

Progress bar component (inline, reusable):
```typescript
function UsageBar({ label, pct }: { label: string; pct: number }) {
  const color = pct >= 80 ? 'bg-destructive' : pct >= 50 ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="w-8 text-right font-mono">{pct}%</span>
    </div>
  )
}
```

### 4. Create Filter Bar (`packages/web/src/components/alert-feed-filters.tsx`)

Simple filter bar with:
- Alert type select (using existing `<select>` or shadcn Select component)
- Seat select (populated from user settings available_seats or all seats for admin)
- Both default to "Tất cả"

### 5. Date Grouping Utility

In alerts page, group alerts by date:
```typescript
function groupByDate(alerts: Alert[]): { label: string; alerts: Alert[] }[] {
  const today = new Date(); today.setHours(0,0,0,0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  const groups: Record<string, Alert[]> = {}
  for (const a of alerts) {
    const d = new Date(a.created_at); d.setHours(0,0,0,0)
    const key = d >= today ? 'Hôm nay'
      : d >= yesterday ? 'Hôm qua'
      : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    ;(groups[key] ??= []).push(a)
  }
  return Object.entries(groups).map(([label, alerts]) => ({ label, alerts }))
}
```

## Todo List
- [ ] Rewrite use-alerts.ts (remove resolve, add filters, add unread-count, add mark-read)
- [ ] Rewrite alerts.tsx page (feed layout, date grouping, filters)
- [ ] Rewrite alert-card.tsx (expandable, all 6 types, rich metadata)
- [ ] Create alert-feed-filters.tsx (type + seat filters)
- [ ] Auto-mark visible alerts as read on page mount
- [ ] Run `pnpm build` to verify compilation

## Success Criteria
- All 6 alert types displayed with correct icons/badges
- Cards expandable with rich inline metadata
- Date grouping works (Today/Yesterday/Date)
- Filters by type and seat functional
- Admin sees all alerts, member sees only watched seats
- No resolve button anywhere
- Responsive on mobile

## Risk Assessment
- **Large rewrite**: 3 files completely rewritten → risk of missed edge cases. Mitigate with thorough testing
- **Data compatibility**: Old alerts with resolved fields still in DB → API ignores them, UI doesn't reference them
- **Performance**: Large alert feeds → limit query to 50, add pagination later if needed
