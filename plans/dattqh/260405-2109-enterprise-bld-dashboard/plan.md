---
name: enterprise-bld-dashboard
status: completed
created: 2026-04-05
slug: enterprise-bld-dashboard
blockedBy: []
blocks: []
---

# Enterprise BLD Dashboard

## Problem
Dashboard hiện tại team-ops oriented, thiếu executive KPIs (fleet util, waste $, W/W delta, rebalance suggestions). Trình BLD ngay = phản hồi "số nhiều, không actionable". Cần layer executive + weekly digest.

## Goal
BLD xem trang `/bld` hiểu tình hình <30s. Waste quantify bằng $ để thuyết phục ROI. Weekly PDF digest cho passive consumption.

## Context
- Brainstorm: `plans/dattqh/reports/brainstorm-260405-2109-enterprise-bld-dashboard.md`
- Cost: **$125/seat/month** default, config qua env `SEAT_MONTHLY_COST_USD` (Claude có thể đổi giá)
- **Gói Teams min 5 seats** — KHÔNG cắt được seat, chỉ rebalance member
- **Scope: LOẠI seats có email thuộc personal domains** (gmail.com, yahoo.com, outlook.com, hotmail.com, icloud.com...)
- Config qua env `PERSONAL_EMAIL_DOMAINS` (comma-separated), có default list
- Code KHÔNG hardcode company domain — giữ project public-safe
- Filter áp dụng ở TẤT CẢ BLD endpoints: fleet util, waste $, user efficiency, forecast, rebalance, PDF
- Rebalance focus: di chuyển MEMBER giữa seats để tối ưu utilization
- Đề xuất **THÊM seat** chỉ khi burndown cao (N seats critical/warning kéo dài)
- Delivery: PDF export link + alert settings mở rộng

## Phases

| # | Phase | Status | Effort | File |
|---|-------|--------|--------|------|
| 1 | Data Quality Fixes (prerequisite) | completed | ~1d | [phase-01-data-quality-fixes.md](phase-01-data-quality-fixes.md) |
| 2 | BLD View Page | completed | ~2-3d | [phase-02-bld-view-page.md](phase-02-bld-view-page.md) |
| 3 | PDF Digest + Alert Settings | completed | ~1-2d | [phase-03-pdf-digest-alerts.md](phase-03-pdf-digest-alerts.md) |

## Dependencies
- P2 depends on P1 (forecast surfaced, data quality clean)
- P3 depends on P2 (reuse metrics endpoints)

## Success criteria
- Fleet util %, waste $, W/W delta displayed on `/bld`
- PDF weekly Friday 17:00 via Telegram system bot
- BLD comprehension <30s in user testing
- No regression on existing dashboard
