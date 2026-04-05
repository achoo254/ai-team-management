# Brainstorm: Auto-Generated Usage Windows (final design)

**Date:** 2026-04-05
**Status:** Final — approved
**Related:** [Root cause analysis](./brainstorm-260405-0007-session-metric-no-data.md)

## Problem
`SessionMetric` chỉ tạo khi schedule kết thúc → dashboard "Hiệu suất sử dụng" trống khi chưa có schedule. Cần stats tự động 100% từ data khác.

## User Goal (anchor)
1. **User quản lý session hiệu quả** — per-user efficiency view
2. **Seats dùng tài nguyên phù hợp theo 5h + 7d** — per-seat utilization + Sonnet/Opus balance

## Data sources
- `usage_snapshots` (cron 5-phút) — `five_hour_pct`, `five_hour_resets_at`, `seven_day_pct`, sonnet/opus splits, `fetched_at`
- `seats.owner_id` — attribution

## Approaches evaluated

| # | Approach | Verdict |
|---|----------|---------|
| 1 | **Chu kỳ reset 5h (natural window)** | ✅ **CHOSEN** — ranh giới tự nhiên, no heuristic |
| 2 | Active burst detection (gap>15min) | ❌ Heuristic tuning, edge cases |
| 3 | Bucket hourly/daily cố định | ❌ Mất khái niệm "phiên", impact ratio khó tính |
| 4 | Hybrid 5h + inactivity | ❌ Over-engineering |

## Final Design

### Decisions
- **Session def:** Chu kỳ reset 5h (khi `five_hour_resets_at` thay đổi giữa 2 snapshot)
- **Attribution:** `owner_id` từ `seats` (pragmatic — Claude API không expose per-user activity)
- **Schema:** Collection mới `UsageWindow` (tách khỏi `SessionMetric` legacy)
- **Backfill:** Scan toàn bộ snapshots, rebuild history
- **Open window:** Tính cả window đang mở, update mỗi cron tick
- **Trigger:** Tích hợp vào cron 5-phút hiện có

### Metrics surface
Utilization %, Waste windows count, Impact ratio (7d/5h), **Sonnet vs Opus split**, Peak hours heatmap, Daily trend, **"My Efficiency" per-user aggregation**.

### Data model
```ts
UsageWindow {
  seat_id, owner_id
  window_start, window_end, is_closed, is_partial, duration_hours
  utilization_pct              // peak five_hour_pct observed
  delta_7d_pct                 // = snapshot_end.7d - snapshot_start.7d
  delta_7d_sonnet_pct
  delta_7d_opus_pct
  impact_ratio                 // delta_7d / utilization (null if util<1)
  is_waste                     // duration≥2h AND utilization<5%
  peak_hour_of_day             // 0-23 VN timezone
  snapshot_start_id, snapshot_end_id
}
```

### Detection logic (pure function, reused in cron + backfill)
```
detectWindowAction({snapshotNow, snapshotPrev, snapshotStart, openWindow, seat_id, owner_id}):
  if snapshotNow.five_hour_resets_at == null → noop
  if openWindow == null && snapshotPrev == null → create_partial
  if snapshotNow.resets_at !== snapshotPrev.resets_at → open_new (close old, create new)
  else → update_open (max utilization, recompute delta_7d vs start)
```

### Cron execution (no transaction — KISS)
`open_new` = create new first (idempotent via unique `seat_id+window_start`) → close old with `is_closed:false` guard. Crash between ops → stale-close cron (30min) heals. No replica set required.

### Edge cases
| Case | Handle |
|------|--------|
| Cron miss 1-2 ticks | Window open vẫn update khi cron chạy lại |
| `five_hour_resets_at` null | Skip, giữ window open |
| Seat mới không S_prev | `is_partial=true` flag |
| Window open >6h (detection fail) | Stale-close cron 30min auto-close |
| Seat missing owner_id | Filter upfront, log warning, skip |

## Trade-offs
**+** 100% auto, reuse cron + data sẵn có, backfill được, per-seat tin cậy, Sonnet/Opus visible
**−** Mất per-user thật khi seat share → chỉ track owner (documented limitation)

## Attribution Limitation (known)
Metrics attribute về `seat.owner_id`. Nếu seat share cho member, usage vẫn tính cho owner. Pragmatic constraint — Claude API không trả user activity per seat.

## Implementation Plan
[260405-1011-auto-usage-windows/](../260405-1011-auto-usage-windows/plan.md) — 5 phases:
1. Model + pure detector (unit testable)
2. Cron integration + stale-close safety
3. Backfill CLI (reuses same detector)
4. API refactor (+ Sonnet/Opus, + My Efficiency aggregation)
5. UI updates (Sonnet/Opus columns, peak hours heatmap, My Efficiency card)

## Unresolved Questions
- None
