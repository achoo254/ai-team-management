---
name: Usage Report Per Cycle
slug: usage-report-per-cycle
created: 2026-04-10
status: completed
mode: fast
blockedBy: []
blocks: []
---

# Usage Report Theo Chu Kỳ Reset 7d — Implementation Plan

## Context
- Brainstorm: `../reports/brainstorm-260410-0904-usage-report-per-cycle.md`
- Goal: chuyển báo cáo usage Telegram từ "T6 9h cố định" sang **auto theo `seven_day_resets_at` của từng seat**.

## Approach
**Per-user smart digest**:
- Cron mỗi giờ (đã có) → tìm seats có `seven_day_resets_at ∈ [now+1h, now+7h)`
- Gom theo user → 1 message gộp các seat đến hạn trong cửa sổ
- Dedup qua `notification_settings.cycle_reported: Map<seat_id, reset_at>`
- Drop hoàn toàn `report_days` + `report_hour`

## Scope
- Backend: schema migration + cron logic + service filter
- Frontend: bỏ ngày/giờ controls khỏi settings UI
- Shared: update DTO
- Tests: unit cho query logic + dedup

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | [Backend — schema + service](./phase-01-backend-schema-service.md) | ✅ completed |
| 2 | [Frontend — settings UI cleanup](./phase-02-frontend-ui.md) | ✅ completed |
| 3 | [Tests + verify](./phase-03-tests-verify.md) | ✅ completed |

## Key dependencies
- Không thêm package mới
- `seven_day_resets_at` field đã tồn tại trong `usage-snapshot.ts`
- Index `usage_snapshots(seat_id, collected_at desc)` cần verify đã có

## Success criteria
- User nhận báo cáo trước seat reset ~1h, không spam
- Mỗi (user, seat, cycle) báo cáo đúng 1 lần
- UI settings bỏ 2 control (ngày + giờ), giữ toggle + "Gửi thử"
- Test "Gửi thử" vẫn hoạt động (bypass dedup)
