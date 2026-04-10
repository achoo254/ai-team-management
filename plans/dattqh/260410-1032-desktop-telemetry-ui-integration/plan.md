---
name: Desktop Telemetry UI Integration
slug: desktop-telemetry-ui-integration
created: 2026-04-10
status: completed
mode: fast
blockedBy: []
blocks: []
extends: 260410-0839-desktop-telemetry-webhook
---

# Desktop Telemetry UI Integration — Implementation Plan

## Context
- Sibling (completed): `../260410-0839-desktop-telemetry-webhook/` — BE ingest endpoint đã xong.
- Brainstorm: trao đổi ngày 2026-04-10 với user (không file report riêng, context nằm trong session chat).
- Gap cần giải quyết:
  1. **Attribution bug** — `webhook-ingest-service.ts` hardcode `profiles[0]` → multi-profile dynamic nhưng session attribute sai.
  2. **Thiếu UI quản lý Device** — user không cách nào tự tạo `api_key` cho desktop app.
  3. **Thiếu UI hiển thị Claude Sessions** — data đã ingest nằm im trong DB.

## Scope
- Chỉ sửa repo `ai-team-management` (web + api). **KHÔNG đụng vào `D:/CONG VIEC/claude-tools`** (desktop app do team khác maintain).
- BE: refactor attribution + thêm route list sessions.
- FE: UI devices trong settings + section Claude Sessions trong `/usage`.

## Design Decisions (agreed)

| Decision | Lựa chọn | Lý do |
|---|---|---|
| Attribution strategy | **First-sight-wins** (`$setOnInsert` cho `profile_email/seat_id`) | KISS — không cần collection mới. Desktop event-driven nên on_change fire liên tục khi active → session mới được attribute đúng ngay khi sinh ra. Sai chỉ ở edge case user switch profile rồi không trigger on_change. |
| Sessions UI placement | **Section mới dưới `UsageSnapshotList`** trong `/usage` | KISS — không convert tabs, không tạo page mới. Scroll progressive disclosure. |
| Devices UI placement | **Section trong `pages/settings.tsx`** | Gộp vào trang settings có sẵn, không thêm nav item. |
| Attribution cho session span profile switch | Chấp nhận sai (first sight wins) | Edge case hiếm, cost vs benefit không hợp lý |
| Legacy sessions (ingest bằng `profiles[0]`) | Không backfill, chấp nhận sai | YAGNI |

## Phases

| # | Phase | File | Priority | Est |
|---|---|---|---|---|
| 1 | BE attribution fix + sessions list route | `phase-01-be-attribution-and-sessions-route.md` | P0 | 1-2h |
| 2 | Devices management UI | `phase-02-devices-ui.md` | P1 | 3-4h |
| 3 | Claude Sessions UI in Usage page | `phase-03-sessions-ui.md` | P1 | 4-5h |

## Build Order
**Sequential.** Phase 1 là blocker cho Phase 3 (sessions phải có `profile_email` đúng trước khi UI render). Phase 2 độc lập — có thể chạy song song với Phase 1 nếu muốn nhưng khuyến nghị tuần tự để dễ review.

## Success Criteria
- Gửi 2 webhook batch với profile active khác nhau → sessions attribute đúng profile tại thời điểm **first insert**, không bị flip khi re-upsert.
- User đăng nhập web → vào Settings → tạo device mới → nhận raw `api_key` (hiển thị 1 lần) → copy vào desktop app → desktop gửi webhook thành công.
- User vào `/usage` → thấy 2 section: "Org Snapshots" (cũ) + "Desktop Sessions" (mới, list session kèm profile_email → seat name, model, tokens, duration).
- Admin thấy sessions của mọi seat; user thường chỉ thấy sessions của seat họ own.
- Không file nào > 200 LOC.
- `pnpm build` + `pnpm lint` pass.

## Out of Scope
- Windows-based attribution (upgrade từ first-sight nếu cần sau).
- Timeline visualization profile switch.
- Filter/search nâng cao trong sessions table (chỉ date range + seat basic).
- Backfill legacy sessions.
- Alert rules dựa trên Claude sessions.
- Desktop app config wizard (chỉ hiển thị hướng dẫn text trong modal).
