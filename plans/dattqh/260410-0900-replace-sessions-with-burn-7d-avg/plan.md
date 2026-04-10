---
name: Replace Sessions(7d) with Burn rate 7d avg
date: 2026-04-10
slug: replace-sessions-with-burn-7d-avg
status: completed
mode: fast
brainstorm: ../reports/brainstorm-260410-0900-replace-sessions-with-burn-7d-avg.md
blockedBy: []
blocks: []
---

# Plan — Thay Sessions(7d) bằng Burn rate 7d avg trong chart "Tốc độ tiêu thụ Seat"

## Goal
Chart so sánh `Burn rate 5h (current)` vs `Burn rate 7d avg (baseline)` để spot spike/drop bất thường. Bỏ session count.

## Context
- Brainstorm: `plans/dattqh/reports/brainstorm-260410-0900-replace-sessions-with-burn-7d-avg.md`
- File chart: `packages/web/src/components/dashboard-seat-efficiency.tsx` (xác nhận sau pull)
- **Insight quan trọng:** Burn rate hoàn toàn tính được client-side từ `seven_day_pct` + `seven_day_resets_at` (đã có trong DTO `SeatUsageItem` — `use-dashboard.ts:20-21`). KHÔNG cần backend.
- Pattern hiện tại: `calcBurnRate5h()` line 15-28 — copy logic cho 7d window (5h → 168h)

## Phases

| # | Phase | Status |
|---|---|---|
| 1 | ~~Backend~~ | **không cần** |
| 2 | Frontend — modify dashboard-seat-efficiency.tsx | done |
| 3 | Tests — full suite pass (112/112) | done |

## Files

**Modify (chỉ 1 file):**
- `packages/web/src/components/dashboard-seat-efficiency.tsx` — 230 LOC, dưới ngưỡng 200 chút, nếu thêm helper vượt thì split

**Tests:**
- `tests/ui/dashboard-seat-efficiency.test.tsx` (nếu chưa có thì create) HOẶC inline trong test có sẵn

## Changes summary
- Thêm `calcBurnRate7d(seat)`: tương tự `calcBurnRate5h` nhưng window = 7×24h, dùng `seven_day_pct` + `seven_day_resets_at`
- Bỏ field `sessions: seat.session_count_7d` → thay bằng `burn_7d_avg: calcBurnRate7d(seat)`
- Update `burnRateColor` reuse cho cả 2 (cùng đơn vị) HOẶC dùng màu xám muted cho baseline
- Bar 2: dataKey `sessions` → `burn_7d_avg`, label `%/h` thay vì integer
- Tooltip: row "Sessions (7d)" → "Burn 7d avg"
- Legend: "Sessions (7d)" → "Burn 7d avg (%/h)"
- Subtitle: "Burn rate 5h và số sessions 7 ngày" → "Burn 5h hiện tại vs trung bình 7 ngày"
- Bỏ `xMax = max(maxBurn, maxSessions)` → chỉ cần `xMax = max(burn5h, burn7d)` (cùng đơn vị)
- Sort: giữ nguyên theo `burn_rate` desc

## Critical decisions
- Cùng đơn vị `%/h` → 1 trục, không cần dual axis (vốn đang chung trục nhưng lệch ý nghĩa)
- Color: burn 5h (theo severity hiện tại), burn 7d avg (xám/muted) — pattern "current vs baseline"
- Guard `seven_day_resets_at == null` → return 0 (đã có pattern trong calcBurnRate5h)

## Risks
- Window 7d không hoàn toàn = "trung bình 7 ngày qua" mà là `pct_hiện_tại / hours_elapsed_trong_window_7d_hiện_tại`. Đây là approximation hợp lý vì usage_snapshots reset cùng với window 7d của Anthropic.
- Seat mới hoặc seat reset gần đây → 7d avg không có nhiều ý nghĩa, sẽ ≈ burn 5h. Chấp nhận được vì design intent là spot spike, không phải báo cáo lịch sử.

## Success criteria
- Chart không còn cột Sessions (7d), thay bằng burn 7d avg `%/h`
- Cả 2 bar cùng đơn vị, dễ so sánh trực quan
- TK Đạt (idle, burn5h=0, burn7d=0) → không bar nào → đúng bản chất
- TK spike (burn5h >> burn7d) → bar 5h dài hơn rõ rệt
- Build pass, tests pass
