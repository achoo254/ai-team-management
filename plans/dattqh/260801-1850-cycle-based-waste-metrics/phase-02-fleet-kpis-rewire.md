# Phase 02 — Rewire `FleetKpis` + lỗi phụ backend

Phụ thuộc: phase 01.

## `quota-efficiency-service.ts`

- (g) đọc chi phí qua `seat-cost.getCycleCostUsd()` thay vì hằng `125` cục bộ.
  Giữ `SEAT_MONTHLY_COST_USD` export cho tương thích ngược nhưng đánh dấu deprecated.
- (h) `safe_decreasing` có `slope_per_hour = 0` → `projected = current_pct` → gần như luôn
  rơi vào bucket lãng phí. Đây là seat vừa bị API điều chỉnh số xuống, không phải lãng phí →
  trả `unknown`.
- (f) thêm `total_waste_usd_monthly` để tầng trên khỏi tự nhân 30/7 và lệch đơn vị.
- thêm `projected_util_pct` = TB `min(100, projected)` trên các seat phân loại được,
  để dòng TỔNG QUAN nói được "chu kỳ này dự kiến đạt bao nhiêu %".

## Tách `bld-metrics-service.ts` (đang 425 LOC)

| Module | Nội dung |
|---|---|
| `fleet-kpi-service.ts` | `computeFleetKpis`, `computeWwHistory`, `computeDdHistory` |
| `rebalance-suggestion-service.ts` | `computeRebalanceSuggestions` |
| `bld-metrics-service.ts` | barrel re-export, giữ nguyên import path của consumer |

## `FleetKpis` mới

| Field | Ý nghĩa |
|---|---|
| `utilPct` | tiêu thụ tính tới hiện tại của chu kỳ đang chạy (không phải trung bình) |
| `cycleUtilPct` | TB đỉnh 4 chu kỳ đã hoàn tất — **cơ sở của `wasteUsd`** |
| `lastCycleUtilPct` | đỉnh chu kỳ hoàn tất gần nhất |
| `cyclesConsidered` | số chu kỳ vào trung bình (0 = chưa đủ dữ liệu) |
| `wasteUsd` | `Σ cost × (1 − avgPct/100)` trên seat có dữ liệu; `null` khi chưa có chu kỳ nào |
| `projectedUtilPct` | dự phóng đạt bao nhiêu % lúc reset của chu kỳ đang chạy |
| `projectedWasteUsd` | lãng phí dự phóng, quy đổi `/tháng`, lấy thẳng từ `efficiency` |
| `wwDelta` | chu kỳ hoàn tất gần nhất − chu kỳ trước, **điểm %**, `null` khi < 2 chu kỳ |
| `staleSeatCount` | seat có snapshot mới nhất quá cũ (đứt collector) |
| `noDataSeatCount` | seat không có snapshot dùng được |

## Lỗi phụ

- (c) `latestSnapshotsFor` trả kèm `fetched_at`; snapshot cũ hơn `STALE_AFTER_MS` (60 phút,
  gấp 12 lần chu kỳ cron 5 phút) bị loại khỏi `utilPct` và đếm vào `staleSeatCount`.
- (d) lãng phí cộng dồn **theo từng seat có dữ liệu** thay vì nhân `totalCostUsd` của cả fleet,
  nên seat thiếu dữ liệu đóng góp $0 thay vì bị coi là lãng phí 100%.
- (b) `historicalFleetUtil` bỏ hẳn — `wwDelta` giờ lấy từ `cycleDeltaPp`, đã `null`-safe.
- (e) `dailyFleetIntensity` dùng mốc ngày VN tính qua offset cố định UTC+7 (VN không có DST).
- (i) `computeWwHistory` chuyển sang một điểm / chu kỳ đã hoàn tất.

## Validation

`pnpm -F @repo/api build`, unit test mới cho `summarizeSeatCycles` + `classifyEfficiency`,
và script đối chiếu DB production.
