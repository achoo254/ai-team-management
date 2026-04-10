---
phase: 3
name: Claude Sessions UI in Usage page
status: completed
priority: P1
blockedBy: [phase-01]
---

# Phase 3 — Claude Sessions UI in Usage page

## Context Links
- Phase 1 output: `GET /api/claude-sessions` route + correct attribution
- FE page hiện tại: `packages/web/src/pages/usage.tsx` (flat, chỉ render `<UsageSnapshotList />`)
- Model: `packages/api/src/models/claude-session.ts`

## Overview
**Priority:** P1
**Description:** Hiển thị Claude sessions từ desktop telemetry dưới section mới trong `/usage` page. User thấy per-session breakdown (model, tokens, profile → seat attribution).

## Key Insights
- **Không convert tabs.** Giữ layout flat, thêm section `<ClaudeSessionsSection />` dưới `<UsageSnapshotList />`.
- Data từ Phase 1 đã có `profile_email` + `seat_id` đúng → UI map seat_id → seat_name qua existing `useSeats()` hook.
- Filter initial: date range (default 7 ngày qua) + seat selector (optional). Pagination đơn giản via `limit` query, không cần cursor.

## Requirements

### Functional
1. Section "Desktop Sessions" trong `/usage` page, xếp dưới "Org Snapshots".
2. Header: title + description + filters (date range picker + seat selector).
3. Table columns:
   - Started at (relative + absolute tooltip)
   - Seat (name + email, link đến seat detail nếu có)
   - Profile email (nếu khác seat email → show cả 2)
   - Model (badge)
   - Duration (ended - started)
   - Input tokens
   - Output tokens
   - Cache read / write (gộp 1 cột)
   - Messages
4. Empty state: "Chưa có session nào. Cài Desktop App và kết nối device."
5. Loading skeleton + error state.
6. Default load 100 session gần nhất, có button "Load more" lên 500.
7. Respect URL param `?seat=xxx` (đã có pattern trong usage.tsx) → filter sessions theo seat đó.

### Non-functional
- React Query caching (staleTime 60s).
- File size < 200 LOC per file.
- Mobile responsive: table → compact cards.

## Architecture

```
packages/web/src/
├─ pages/usage.tsx                             // ADD: <ClaudeSessionsSection />
├─ components/
│  ├─ claude-sessions-section.tsx              // NEW: wrapper (header + filters + table)
│  ├─ claude-sessions-table.tsx                // NEW: table rows
│  └─ claude-sessions-filters.tsx              // NEW: date range + seat selector
├─ hooks/use-claude-sessions.ts                // NEW: React Query
└─ lib/api-client.ts                           // EXTEND: claudeSessionsApi.list
```

## Related Code Files

### Modify
- `packages/web/src/pages/usage.tsx` — thêm section
- `packages/web/src/lib/api-client.ts` — thêm `claudeSessionsApi`

### Create
- `packages/web/src/components/claude-sessions-section.tsx`
- `packages/web/src/components/claude-sessions-table.tsx`
- `packages/web/src/components/claude-sessions-filters.tsx`
- `packages/web/src/hooks/use-claude-sessions.ts`

### Read for context
- `packages/web/src/pages/usage.tsx`
- `packages/web/src/components/usage-snapshot-list.tsx` — tham khảo pattern
- `packages/web/src/hooks/use-seats.ts` — reuse để map seat name
- `packages/api/src/models/claude-session.ts` — field shape

## Implementation Steps

1. **Extend API client**
   - `claudeSessionsApi.list(params: { seat_id?, profile_email?, since?, until?, limit? }) → Promise<{ sessions, total }>`

2. **Hook `use-claude-sessions.ts`**
   - `useClaudeSessions(filters)` — `useQuery(['claude-sessions', filters], ...)` với staleTime 60s
   - Query key bao gồm filters để cache riêng biệt

3. **Component `claude-sessions-filters.tsx`**
   - Props: `{ filters, onChange }`
   - Date range picker (shadcn/ui Calendar trong Popover) — default: last 7 days
   - Seat selector (Select dropdown) — load seats via `useSeats()`, "All seats" option
   - Debounce input changes

4. **Component `claude-sessions-table.tsx`**
   - Props: `{ sessions, seats: Map<id, seat>, isLoading }`
   - Columns như spec
   - Duration tính từ `started_at` / `ended_at`, format human-friendly (`formatDuration` helper)
   - Token numbers format với locale grouping
   - Model badge: color theo model family (sonnet/opus/haiku)
   - Loading skeleton rows
   - Empty state

5. **Component `claude-sessions-section.tsx`**
   - State filters (controlled)
   - Init filters từ URL `?seat=xxx` nếu có (dùng `useSearchParams`)
   - `useClaudeSessions(filters)` + `useSeats()` → build seat lookup map
   - Render filters + table + "Load more" button
   - "Load more" state local: `limit` lên từng bước 100

6. **Mount vào `pages/usage.tsx`**
   - Import `<ClaudeSessionsSection />`
   - Render dưới `<UsageSnapshotList />` với spacing

7. **Manual smoke test**
   - Desktop app gửi vài webhook batch
   - Mở `/usage` → scroll xuống → thấy section "Desktop Sessions"
   - Filter theo seat → data thu hẹp đúng
   - Load more → thêm rows
   - Navigate `/usage?seat=xxx` → pre-filter đúng seat

## Todo List

- [x] Extend `api-client.ts` với `claudeSessionsApi`
- [x] Hook `use-claude-sessions.ts`
- [x] Component `claude-sessions-filters.tsx` (date range + seat selector)
- [x] Component `claude-sessions-table.tsx` (với loading/empty states)
- [x] Component `claude-sessions-section.tsx` (wrapper + URL param init + load more)
- [x] Mount `<ClaudeSessionsSection />` vào `pages/usage.tsx`
- [x] Manual smoke test end-to-end (desktop → BE → UI)
- [x] `pnpm build` pass
- [x] `pnpm lint` pass

## Success Criteria
- User vào `/usage` thấy 2 section, scroll mượt.
- Filter date range + seat hoạt động.
- "Load more" không break scroll position.
- URL `?seat=xxx` pre-filter đúng.
- Mobile layout readable.
- Không file nào > 200 LOC.

## Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Sessions nhiều → query chậm | UX | Default limit 100 + index `{ seat_id: 1, started_at: -1 }` trên `ClaudeSession` (add trong Phase 1 nếu chưa có) |
| Legacy sessions có `profile_email` sai (attribute bằng `profiles[0]`) | Confusion | Hiển thị badge "Legacy attribution" nếu `received_at < phase-1-deploy-date`? → **SKIP, YAGNI**. Chấp nhận data cũ lẫn mới. |
| Seat đã delete nhưng session còn reference `seat_id` | Orphan rows | Table render "Unknown seat" nếu lookup không match |
| Profile email không trùng seat email | Data hiển thị rối | Column "Profile" hiển thị email riêng, cột "Seat" hiển thị seat map (null-safe) |

## Security Considerations
- Route `/api/claude-sessions` đã auth + seat-scoped permission (Phase 1).
- FE không cần check permission lại — trust API filter.

## Next Steps
- Phase polish (optional sau này):
  - Export CSV
  - Chart trend tokens theo ngày
  - Alert rules dựa trên session patterns
  - Admin debug view: profile switch timeline
