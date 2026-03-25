---
title: "Convert to Next.js 15 + shadcn/ui + Tailwind v4"
description: "Big bang rewrite từ Alpine.js/Express sang Next.js full-stack với mobile-first responsive"
status: pending
priority: P1
effort: 15d
branch: feat/nextjs-migration
tags: [frontend, backend, migration, mobile, react]
created: 2026-03-23
---

# Convert to Next.js 15 + shadcn/ui + Tailwind v4

## Overview

Rewrite toàn bộ frontend (Alpine.js) và backend (Express) sang Next.js 15 App Router full-stack. Mobile responsive cho tất cả 7 views. Giữ nguyên Mongoose + MongoDB.

## Context

- [Brainstorm Report](../reports/brainstorm-260323-0714-react-tailwind-migration.md)
- Current: ~2,042 lines frontend, 40+ API endpoints, 6 models, 4 services
- Target: Next.js 15, TypeScript, shadcn/ui, TanStack Query v5, Recharts, @dnd-kit

## Tech Stack

| Layer | Current | Target |
|-------|---------|--------|
| Framework | Express 5 + Alpine.js | Next.js 15 App Router |
| Language | JavaScript (CJS) | TypeScript |
| UI | Tailwind CDN | shadcn/ui + Tailwind v4 |
| State | Alpine.js reactive | TanStack Query v5 |
| Charts | Chart.js 4.4 | Recharts |
| Auth | Firebase + JWT cookie | Firebase + JWT middleware |
| DnD | HTML5 native | @dnd-kit/core |
| DB | Mongoose + MongoDB | Mongoose + MongoDB (giữ) |

## Phases

| # | Phase | Status | Effort | Link |
|---|-------|--------|--------|------|
| 1 | Project setup & foundation | Pending | 2d | [phase-01](./phase-01-project-setup.md) |
| 2 | Models, services & lib | Pending | 1.5d | [phase-02](./phase-02-models-services.md) |
| 3 | API route handlers | Pending | 2.5d | [phase-03](./phase-03-api-routes.md) |
| 4 | Auth flow & layout | Pending | 2d | [phase-04](./phase-04-auth-layout.md) |
| 5 | Dashboard & charts | Pending | 2d | [phase-05](./phase-05-dashboard-charts.md) |
| 6 | CRUD views (seats, teams, alerts, admin, usage-log) | Pending | 3d | [phase-06](./phase-06-crud-views.md) |
| 7 | Schedule & drag-drop | Pending | 2d | [phase-07](./phase-07-schedule-dnd.md) |
| 8 | Mobile polish, cron & deploy | Pending | 1.5d | [phase-08](./phase-08-mobile-cron-deploy.md) |

## Dependencies & Execution Strategy

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 (sequential, 1 person)
                                  ↓
                    ┌─────────────┼─────────────┐
                    ↓             ↓             ↓
                 Phase 5      Phase 6      Phase 7   (parallel, 2-3 people)
                    └─────────────┼─────────────┘
                                  ↓
                               Phase 8 (sequential, 1 person)
```

- **Sequential (P1→P4):** Foundation work, 1 person, ~8 days
- **Parallel (P5+P6+P7):** 3 people work simultaneously, ~3 days wall time
- **Final (P8):** Polish + deploy, 1 person, ~1.5 days
- **Total wall time: ~12.5 days** (with 2-3 people)

## Validated Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Deploy | VPS + PM2 | Giữ nguyên infra, cron worker chạy cùng server |
| API compat | Không cần | Chỉ dashboard frontend gọi API, tự do thay đổi |
| Testing | Manual testing | Internal tool nhỏ, test thủ công từng feature |
| Team | 2-3 người | Phase 5/6/7 parallel, giảm wall time |

## Key Risks

| Risk | Mitigation |
|------|------------|
| Mongoose in serverless | NOT serverless — VPS + PM2, standard connection |
| Cron jobs | Separate cron-worker.ts script, PM2 manages lifecycle |
| Vietnamese IME | Test controlled inputs, use onChange with debounce if needed |
| Auth migration | Keep same JWT format, test extensively |
| Parallel conflicts | Phase 5/6/7 have zero file overlap — safe to parallel |
