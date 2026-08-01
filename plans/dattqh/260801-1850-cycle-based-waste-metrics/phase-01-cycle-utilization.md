# Phase 01 — Tách module chi phí/scope + `cycle-utilization-service`

## Mục tiêu

Có nguồn dữ liệu "tận dụng theo chu kỳ đã hoàn tất" để phase 02 dùng, và gỡ vòng phụ thuộc
chi phí giữa `bld-metrics-service` ↔ `quota-efficiency-service`.

## Files tạo mới

- `packages/api/src/services/seat-cost.ts` — `getMonthlyCostUsd()` (chuyển từ `bld-metrics-service`)
- `packages/api/src/services/metrics-scope.ts` — `MetricsScope`, `getSeatsInScope()`
- `packages/api/src/services/cycle-utilization-service.ts` — tổng hợp chu kỳ đã hoàn tất

## Thiết kế `cycle-utilization-service`

Một chu kỳ = tập snapshot có cùng `seven_day_resets_at`. Giá trị này **jitter theo ms** giữa các
lần gọi Anthropic API (đo được ~1950 giá trị phân biệt / seat / 30 ngày), nên phải **làm tròn về
giờ gần nhất** trước khi group. Làm tròn (không phải floor) vì có mốc rơi vào `22:59:59.960Z`.

`seven_day_pct` tăng đơn điệu trong chu kỳ → `max` = lượng quota thực sự tiêu thụ cả chu kỳ.

Chỉ nhận chu kỳ đã qua mốc reset (`resets_at < now`) và có `>= MIN_CYCLE_SAMPLES` snapshot
(1 ngày × 12 snapshot/h = 288) để một chu kỳ thu thập lỗi dở không tạo đỉnh giả.

Trả về per-seat `completed[]` (mới nhất trước), `lastCyclePct`, `avgPct`; và mức fleet
`avgUtilPct`, `lastCycleUtilPct`, `prevCycleUtilPct` (mốc so sánh W/W), `seatsWithData`.

`prevCycleUtilPct` chỉ tính trên seat có **cả hai** chu kỳ, để delta không so lệch tập seat.

## Validation

- Unit test thuần cho phần gộp chu kỳ (`summarizeSeatCycles`) — không cần DB.
- Đối chiếu số liệu production: `avgUtilPct ≈ 86.2`, `lastCycleUtilPct ≈ 98.2`.

## Rủi ro

Aggregation quét ~5 tuần snapshot (~60k doc). Dùng index sẵn có `{seat_id: 1, fetched_at: -1}`;
gộp ở tầng DB nên chỉ trả về ~30 doc.
