---
name: token-first-seat-creation
slug: token-first-seat-creation
status: completed
createdAt: 2026-04-05
completedAt: 2026-04-05
blockedBy: []
blocks: []
---

# Plan: Token-First Seat Creation

**Context:** [brainstorm report](../reports/brainstorm-260405-2305-token-first-seat-creation.md)

## Goal

Gộp 2 dialog (SeatFormDialog + SeatTokenDialog) → **1 flow single-step**. User paste JSON credential → BE auto-fetch `/api/oauth/profile` → auto-fill email, label, org metadata. User chỉ nhập `max_users` + (optional) override label.

## Key Decisions (từ brainstorm)

- Label default = `account.full_name`, overridable
- Duplicate email → reject với message hướng dẫn dùng Update Token
- Advanced mode fallback manual (khi profile API fail)
- KHÔNG thêm `account_uuid`/`organization_uuid` fields
- Reuse `tryParse()` helper từ `seat-token-dialog.tsx`
- Giữ nguyên `PUT /:id/token` + `seat-token-dialog.tsx`

## Phases

| # | Phase | Status | File |
|---|---|---|---|
| 1 | Shared helper + BE service + preview endpoint | completed | [phase-01](phase-01-shared-helper-and-profile-service.md) |
| 2 | BE token-first POST /api/seats | completed | [phase-02-backend-create-seat-token-first.md](phase-02-backend-create-seat-token-first.md) |
| 3 | FE rewrite seat-form-dialog create mode | completed | [phase-03-frontend-rewrite-form-dialog.md](phase-03-frontend-rewrite-form-dialog.md) |
| 4 | Tests + polish | completed | [phase-04-tests-and-polish.md](phase-04-tests-and-polish.md) |

## Success Criteria

- Tạo seat = 1 dialog, 1 submit
- Auto-fill email + label từ profile API
- Duplicate email reject với friendly message
- Advanced mode manual fallback hoạt động khi profile API down
- `PUT /:id/token` flow update không bị ảnh hưởng
- Tests pass cho tất cả paths (happy, duplicate, profile-fail, manual)

## Dependencies

None — self-contained feature.
