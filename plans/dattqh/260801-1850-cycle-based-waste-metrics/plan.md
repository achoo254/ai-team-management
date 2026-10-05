# Lãng phí & tận dụng theo chu kỳ đã hoàn tất

**Status:** done
**Ngày:** 2026-08-01
**Quyết định:** [ADR-0001](../../../docs/decisions/0001-do-lang-phi-theo-chu-ky-da-hoan-tat.md)

## Vấn đề

`wasteUsd` được tính bằng `totalCostUsd * (1 - utilPct / 100)` với `utilPct` là trung bình
`seven_day_pct` của snapshot **mới nhất**. `seven_day_pct` là bộ đếm tích lũy chạy 0% → 100%
rồi reset, nên đo giữa chu kỳ thực chất là đo *"còn bao lâu nữa tới reset"*, không phải lãng phí.

Kiểm chứng trên DB production (6 seats, 2026-08-01):

| Cách đo | Tận dụng | Lãng phí |
|---|---|---|
| Công thức hiện tại | 54.5% | **$341/tháng** |
| Đỉnh chu kỳ đã hoàn tất gần nhất | 98.2% | $14/tháng |
| TB 4 chu kỳ đã hoàn tất | 86.2% | $103/tháng |
| Dự phóng chu kỳ đang chạy | ~99% | ~$8/tháng |

Cùng công thức, dựng lại theo giờ trong 14 ngày: dao động **$24 … $584** chỉ vì thời điểm gửi
report rơi vào đâu trong chu kỳ. Đồng thời mâu thuẫn với dòng HIỆU SUẤT ngay dưới nó trong cùng
message Telegram (`5/6 seat quá tải`, `0 seat lãng phí`).

## Hướng giải quyết

- **A** — Dòng dự phóng lấy đúng `computeFleetEfficiency` làm nguồn duy nhất, quy đổi ra `/tháng`.
  Hai dòng trong cùng message không bao giờ chọi nhau nữa.
- **B** — Con số `/tháng` dùng đỉnh `seven_day_pct` của các **chu kỳ đã hoàn tất** (TB 4 chu kỳ).

## Phases

| Phase | Nội dung | File |
|---|---|---|
| 01 | Tách module chi phí/scope, dựng `cycle-utilization-service` | [phase-01-cycle-utilization.md](phase-01-cycle-utilization.md) |
| 02 | Rewire `FleetKpis` (A+B) + sửa lỗi phụ backend | [phase-02-fleet-kpis-rewire.md](phase-02-fleet-kpis-rewire.md) |
| 03 | Telegram + web dashboard + export HTML | [phase-03-surfaces.md](phase-03-surfaces.md) |
| 04 | Sửa test harness (phát sinh) | [phase-04-test-harness-repair.md](phase-04-test-harness-repair.md) |

Phase 02 phụ thuộc 01; phase 03 phụ thuộc 02. Phase 04 phát sinh khi thêm test cho 01–03:
`vitest.config.ts` dùng allowlist thủ công nên 11 file test chưa từng chạy (24 → 33 file, 198 → 280 test).

## Lỗi phụ xử lý kèm

| # | Lỗi | Nơi |
|---|---|---|
| a | `wwDelta` so hai mẫu giữa chu kỳ, nhiễu theo phase; hậu tố `%` sai đơn vị | `bld-metrics-service.ts:154` |
| b | `historicalFleetUtil` trả `0` khi không có dữ liệu → delta tăng vọt giả | `bld-metrics-service.ts:117` |
| c | `latestSnapshotsFor` không lọc độ tươi → giá trị chết vẫn vào trung bình | `bld-metrics-service.ts:61` |
| d | Seat thiếu dữ liệu bị loại khỏi tử số nhưng vẫn ở mẫu số | `bld-metrics-service.ts:126-141` |
| e | `dailyFleetIntensity` dùng timezone process, không phải VN | `bld-metrics-service.ts:85-87` |
| f | Dòng TỔNG QUAN `$/tháng` mốc 100%, dòng HIỆU SUẤT `$/chu kỳ` mốc 85% | `telegram-service.ts:109,130` |
| g | `quota-efficiency-service` hardcode `125`, bỏ qua env | `quota-efficiency-service.ts:12` |
| h | `safe_decreasing` (slope=0) bị xếp nhầm vào bucket lãng phí | `quota-efficiency-service.ts:39` |
| i | Dashboard + export HTML + `computeWwHistory` dùng chung công thức sai | web + `bld-metrics-service.ts:203` |

## Acceptance

- Fleet KPI trên DB production ra `cycleUtilPct ≈ 86%`, `wasteUsd ≈ $103`, `projectedWasteUsd ≈ $0`.
- Message Telegram không còn hai con số lãng phí chọi nhau.
- Seat mất snapshot > ngưỡng không âm thầm vào trung bình; được đếm riêng.
- `pnpm lint`, `pnpm -F @repo/api build`, `pnpm -F @repo/web build`, `pnpm test` xanh.
- Mọi file chạm vào < 200 LOC.
