---
name: Auto-Generated Usage Windows (no schedule dependency)
status: completed
created: 2026-04-05
branch: main
phases: 5
blockedBy: []
blocks: []
---

# Auto-Generated Usage Windows

## Context
- [Brainstorm](../reports/brainstorm-260405-1011-auto-usage-windows.md)
- [Root cause analysis](../reports/brainstorm-260405-0007-session-metric-no-data.md)

## Problem
Dashboard "Hiệu suất sử dụng" trống vì `SessionMetric` chỉ tạo khi schedule kết thúc. Cần stats tự động 100%, không phụ thuộc lịch phân ca.

## Solution
Model mới `UsageWindow`: mỗi chu kỳ reset 5h của Claude = 1 window. Detection tích hợp vào cron 5-phút hiện có. Attribution qua `seat.owner_id`. Backfill từ `usage_snapshots` cũ.

## Goal Alignment
- **Seats dùng tài nguyên phù hợp theo 5h + 7d:** per-seat utilization%, waste count, Sonnet vs Opus breakdown → surface seat nào đang tốn Opus đắt
- **User quản lý session hiệu quả:** per-user aggregation (owner-based) + "My Efficiency" tab → user xem top/bottom seats của mình

## Attribution Limitation (known)
Metrics attributed to `seat.owner_id`. Nếu seat được share cho member (role=member), usage vẫn tính cho owner. Pragmatic constraint — Claude API không trả user activity per seat. Không giải quyết được cho tới khi có thêm data source.

## Phases

| # | Phase | Status | Owner |
|---|-------|--------|-------|
| 1 | [UsageWindow model + detection service](./phase-01-model-and-detection.md) | completed | backend |
| 2 | [Cron integration in usage-collector](./phase-02-cron-integration.md) | completed | backend |
| 3 | [Backfill CLI script](./phase-03-backfill-script.md) | completed | backend |
| 4 | [Dashboard API refactor](./phase-04-api-endpoint-refactor.md) | completed | backend |
| 5 | [UI updates + peak hours heatmap](./phase-05-ui-updates.md) | completed | frontend |

## Dependencies
Phase 1 → 2 → 3 (parallel with 4) → 5. Phase 4 depends on Phase 1 (model exists).

## Success Criteria
- `/api/dashboard/efficiency` trả data không rỗng ngay sau deploy (nhờ backfill)
- Window mới tự close khi reset xảy ra, không cần schedule
- Per-seat table hiển thị Sonnet vs Opus split
- "My Efficiency" section trong /personal cho user xem top/bottom seats
- Peak hours heatmap hiển thị pattern theo (day_of_week, hour)
- Tests pass, no regression trên SessionMetric legacy endpoint
