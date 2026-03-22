---
title: AI Account Management Dashboard
status: completed
priority: P1
effort: medium
tags: [dashboard, anthropic-api, team-management]
created: 2026-03-20
---

# AI Account Management Dashboard

Dashboard web quản lý tài khoản AI cho team 13 người (7 Dev + 6 MKT), 5 Claude Teams seats.

## Context
- Quy định: `Quy-dinh-su-dung-tai-khoan-AI.docx`
- API Reference: `plans/reports/researcher-260320-1339-anthropic-apis-reference.md`
- PM Report: `plans/reports/pm-260320-1333-quan-ly-tai-khoan-ai-team.md`

## Account Structure
| Seat | Email | Team | Users | Role |
|------|-------|------|-------|------|
| 1 | dattqh@inet.vn | Dev | Đạt + Hổ | **Admin** |
| 2 | hoangnh@inet.vn | Dev | Hoàng + Chương | User |
| 3 | anhtct@inet.vn | Dev | ViệtNT + Đức + Tuấn Anh | User |
| 4 | trihd@inet.vn | MKT | Trí + Hậu + Trà | User |
| 5 | quanlm@inet.vn | MKT | Quân + Ngọc + Phương | User |

## Tech Stack
- **Frontend:** HTML + TailwindCSS + Alpine.js (lightweight, no build step)
- **Backend:** Node.js + Express (simple API proxy + cron)
- **Database:** SQLite (zero-config, file-based, đủ cho 13 users)
- **Auth:** Simple password auth (admin/user roles)
- **Deploy:** Single VPS hoặc Cloudflare Workers
- **Cron:** node-cron daily pull Anthropic API

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Project Setup](phase-01-project-setup.md) | completed | 0.5 day |
| 2 | [Database & Models](phase-02-database-models.md) | completed | 0.5 day |
| 3 | [Anthropic API Integration](phase-03-anthropic-api.md) | completed | 1 day |
| 4 | [Backend API](phase-04-backend-api.md) | completed | 1 day |
| 5 | [Frontend Dashboard](phase-05-frontend-dashboard.md) | completed | 1.5 days |
| 6 | [Alerts & Notifications](phase-06-alerts.md) | completed | 0.5 day |
| 7 | [Testing & Deploy](phase-07-testing-deploy.md) | in-progress | 0.5 day |

**Total estimate:** ~5 days (1 dev)

## Key Features
1. **Usage Dashboard** — per-user token/cost/sessions from Claude Code Analytics API
2. **Seat Management** — phân bổ seat, mapping user↔seat
3. **Slot Scheduling** — lịch phân ca cho seats có 3 người
4. **Alerts** — cảnh báo khi usage cao
5. **Audit Logs** — lịch sử sử dụng, export báo cáo
