# Brainstorm: Convert to React + Tailwind (Mobile Support)

**Date:** 2026-03-23
**Status:** Agreed

## Problem Statement

Internal Claude Teams dashboard (Alpine.js + Express + vanilla JS) cần:
1. Hỗ trợ giao diện mobile hoàn chỉnh cho tất cả 7 views
2. Modernize tech stack để dễ maintain và mở rộng

Hiện trạng: ~2,042 lines frontend code, 7 views, Alpine.js SPA, hash-based routing, Chart.js, Firebase Auth, Tailwind CDN. Không có build step.

## Evaluated Approaches

### Option 1: Vite + React SPA (Giữ Express backend)
- **Pros:** Backend 0 thay đổi, nhanh hơn, ít rủi ro
- **Cons:** 2 processes (Vite dev + Express), không SSR, cần proxy config
- **Verdict:** An toàn nhưng bỏ lỡ cơ hội unify stack

### Option 2: Next.js Frontend + Express Backend (Proxy)
- **Pros:** SSR + giữ backend ổn định
- **Cons:** 2 servers production, config phức tạp, deploy phức tạp
- **Verdict:** Worst of both worlds

### Option 3: Next.js Full-stack ✅ CHOSEN
- **Pros:** Unified stack, SSR, code splitting, 1 deploy, TypeScript end-to-end
- **Cons:** Migrate API routes, auth flow thay đổi, cron jobs cần giải pháp khác
- **Verdict:** Best long-term choice cho internal tool cỡ này

## Final Recommended Solution

### Tech Stack

| Layer | Current | New |
|-------|---------|-----|
| Framework | Express 5 + Alpine.js | **Next.js 15 App Router** |
| Language | JavaScript (CommonJS) | **TypeScript** |
| UI Library | Tailwind CDN + vanilla | **shadcn/ui + Tailwind v4** |
| State | Alpine.js reactive | **TanStack Query v5** |
| Charts | Chart.js 4.4 | **Recharts** |
| Auth | Firebase + JWT cookie | **Firebase + NextAuth.js** (hoặc middleware-based JWT) |
| Database | Mongoose + MongoDB | **Mongoose + MongoDB** (giữ nguyên) |
| DnD | HTML5 native | **@dnd-kit/core** |
| Routing | Hash-based SPA | **Next.js App Router** (file-based) |

### Project Structure

```
├── app/
│   ├── layout.tsx              # Root layout (nav, auth provider)
│   ├── page.tsx                # Dashboard (default route)
│   ├── login/page.tsx          # Login page
│   ├── seats/page.tsx          # Seat management
│   ├── schedule/page.tsx       # Schedule grid
│   ├── log-usage/page.tsx      # Weekly usage logging
│   ├── alerts/page.tsx         # Alerts
│   ├── teams/page.tsx          # Team management
│   ├── admin/page.tsx          # Admin panel
│   ├── api/                    # API Route Handlers
│   │   ├── auth/
│   │   │   ├── google/route.ts
│   │   │   └── me/route.ts
│   │   ├── dashboard/
│   │   │   ├── summary/route.ts
│   │   │   ├── usage/route.ts
│   │   │   └── enhanced/route.ts
│   │   ├── seats/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── assign/route.ts
│   │   │       └── unassign/[userId]/route.ts
│   │   ├── schedules/
│   │   ├── usage-log/
│   │   ├── alerts/
│   │   ├── teams/
│   │   └── admin/
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn/ui components
│   ├── layout/
│   │   ├── sidebar.tsx         # Responsive sidebar (drawer on mobile)
│   │   ├── mobile-nav.tsx      # Bottom nav for mobile
│   │   └── header.tsx
│   ├── dashboard/
│   │   ├── stat-cards.tsx
│   │   ├── usage-chart.tsx     # Recharts bar
│   │   ├── trend-chart.tsx     # Recharts line
│   │   └── team-chart.tsx      # Recharts pie
│   ├── seats/
│   │   ├── seat-card.tsx
│   │   ├── seat-form-modal.tsx
│   │   └── assign-modal.tsx
│   ├── schedule/
│   │   ├── schedule-grid.tsx   # @dnd-kit
│   │   ├── member-sidebar.tsx
│   │   └── schedule-cell.tsx
│   ├── usage-log/
│   │   ├── week-table.tsx
│   │   └── week-navigator.tsx
│   └── shared/
│       ├── data-table.tsx      # Reusable table
│       ├── confirm-dialog.tsx
│       └── loading-skeleton.tsx
├── hooks/
│   ├── use-auth.ts
│   ├── use-seats.ts            # TanStack Query hooks
│   ├── use-schedules.ts
│   ├── use-usage-log.ts
│   ├── use-alerts.ts
│   ├── use-teams.ts
│   └── use-admin.ts
├── lib/
│   ├── api-client.ts           # Fetch wrapper (migrate from current)
│   ├── firebase-admin.ts       # Firebase Admin init
│   ├── firebase-client.ts      # Firebase client config
│   ├── mongoose.ts             # Mongoose connection singleton
│   ├── auth.ts                 # JWT middleware for API routes
│   └── utils.ts
├── models/                     # Mongoose models (migrate from server/models)
│   ├── seat.ts
│   ├── user.ts
│   ├── usage-log.ts
│   ├── schedule.ts
│   ├── alert.ts
│   └── team.ts
├── services/                   # Business logic (migrate from server/services)
│   ├── alert-service.ts
│   ├── telegram-service.ts
│   └── usage-sync-service.ts
└── types/
    └── index.ts                # Shared TypeScript types
```

### Mobile Strategy

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Navigation | Sidebar (fixed left) | Bottom tab bar + hamburger drawer |
| Dashboard stats | 4-col grid | 2-col grid, swipeable cards |
| Charts | Side-by-side | Stacked, full-width |
| Data tables | Full table | Card view hoặc horizontal scroll |
| Schedule grid | Full grid | Day-by-day view (tab per day) |
| Modals | Center overlay | Bottom sheet (full-width) |
| Drag & Drop | Mouse drag | Touch-friendly @dnd-kit |
| Forms | Inline | Full-screen modal |

### Migration Phases (Big Bang nhưng có phân đoạn nội bộ)

**Phase 1: Foundation (2-3 ngày)**
- Next.js project setup + TypeScript config
- Tailwind v4 + shadcn/ui init
- Mongoose connection singleton
- Migrate models (JS → TS)
- Firebase client + admin setup
- Auth middleware cho API routes

**Phase 2: API Routes (2-3 ngày)**
- Migrate 30+ Express routes → Next.js Route Handlers
- Giữ nguyên logic, refactor format (req/res → NextRequest/NextResponse)
- Auth middleware (JWT verify)
- Test bằng Postman/Thunder Client

**Phase 3: Core UI (3-4 ngày)**
- Layout (sidebar, mobile nav, header)
- Auth flow (login page, protected routes)
- Dashboard page + Recharts
- TanStack Query setup + hooks

**Phase 4: CRUD Views (3-4 ngày)**
- Seats page + modals
- Teams page
- Alerts page
- Admin page
- Log Usage page + week navigation

**Phase 5: Schedule & DnD (2-3 ngày)**
- Schedule grid với @dnd-kit
- Touch support cho mobile
- Day-by-day mobile view

**Phase 6: Polish & Deploy (1-2 ngày)**
- Responsive testing tất cả views
- Vietnamese IME testing
- Cron job solution (Vercel Cron hoặc external)
- Error handling, loading states
- Deploy + cutover

**Tổng ước tính: 13-19 ngày**

## Critical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cron jobs mất khi bỏ Express | Telegram reminders ngừng | Vercel Cron / external cron service |
| Auth flow break | Users không login được | Test kỹ Firebase + JWT flow trước khi cutover |
| Mongoose connection trong serverless | Connection pool issues | Mongoose singleton pattern + connection caching |
| Mobile DnD performance | Schedule khó dùng trên mobile | @dnd-kit touch sensors + fallback UI |
| Vietnamese IME | Input lag/duplicate chars | Test controlled vs uncontrolled inputs, debounce |
| Data migration | Không cần — giữ MongoDB | N/A |

## Cron Jobs Solution

Express hiện chạy 2 cron jobs:
- Friday 15:00 AST: Telegram reminder
- Friday 17:00 AST: Telegram reminder

Options:
1. **Vercel Cron** (nếu deploy Vercel) — `vercel.json` cron config
2. **Separate worker** — Giữ 1 file Node.js nhỏ chạy cron, deploy riêng
3. **External service** — cron-job.org, GitHub Actions scheduled workflow

**Recommended:** Option 2 — tách worker script nhỏ, deploy song song. Đơn giản, reliable.

## Success Metrics

- [ ] Tất cả 7 views hoạt động đúng trên desktop
- [ ] Tất cả 7 views responsive trên mobile (≥375px)
- [ ] Lighthouse mobile score ≥ 90
- [ ] Auth flow hoạt động (login, session, admin gating)
- [ ] Chart data hiển thị đúng (3 charts)
- [ ] Schedule drag-drop hoạt động cả desktop và mobile
- [ ] Vietnamese IME input hoạt động
- [ ] Cron jobs chạy đúng lịch
- [ ] Zero regression so với version cũ

## Next Steps

1. Tạo implementation plan chi tiết với `/plan`
2. Setup Next.js project trong thư mục mới (hoặc branch riêng)
3. Bắt đầu Phase 1: Foundation
