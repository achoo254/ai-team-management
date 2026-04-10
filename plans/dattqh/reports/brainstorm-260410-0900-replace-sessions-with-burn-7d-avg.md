---
type: brainstorm
date: 2026-04-10
slug: replace-sessions-with-burn-7d-avg
status: approved
---

# Brainstorm — Thay Sessions(7d) bằng Burn rate 7d avg trong chart "Tốc độ tiêu thụ Seat"

## Problem
Chart hiện ghép `Burn rate 5h (%/h)` với `Sessions (7d)`. Hai metric lệch pha:
- Sessions chỉ đếm số phiên login → không phản ánh tiêu thụ
- Vd thực tế: TK Đạt = 0%/h burn nhưng 16 sessions → bar gây hiểu nhầm "đang dùng nhiều"
- Khác đơn vị (`%/h` vs `count`) → mắt khó so sánh, chart cần 2 trục

## Mục tiêu
Phát hiện **spike/drop bất thường** của burn rate so với baseline tuần.

## Giải pháp chốt
**Thay `Sessions (7d)` → `Burn rate 7d avg (%/h)`**

### Logic đọc chart
| Tình huống | Ý nghĩa |
|---|---|
| Burn 5h >> 7d avg | Spike — đang nóng bất thường |
| Burn 5h ≈ 7d avg | Bình thường |
| Burn 5h << 7d avg | Drop — chậm bất thường |
| Cả 2 ≈ 0 | Seat idle (đúng bản chất) |

### Lý do chọn
- Cùng đơn vị `%/h` → 1 trục, so sánh trực tiếp
- Pair "current vs baseline" là pattern chuẩn để spot anomaly
- Không cần thêm trục phụ, không phá layout hiện tại
- Reuse được data `usage_snapshots` (cron 5 phút × 7d ≈ 2016 điểm/seat → đủ)

## Approaches đã đánh giá
| Phương án | Pros | Cons | Verdict |
|---|---|---|---|
| **Burn 7d avg** | Cùng unit, spot spike rõ | Cần aggregate 7d | ✅ Chọn |
| ETA cạn quota | Actionable cao | Khác unit, cần trục phụ | ❌ |
| Peak burn 24h | Bắt seat hay spike | Ít context daily ops | ❌ |
| % quota đã dùng | Trực quan | Trùng ý nghĩa burn rate | ❌ |
| Active hours 7d | Cải tiến nhẹ session | Vẫn không phản ánh tiêu thụ | ❌ |

## Implementation considerations
- **Backend:** thêm field `burn_rate_7d_avg_pct_per_hour` vào DTO của `/api/bld-metrics` (hoặc dashboard endpoint phụ trách chart này — cần scout)
- **Service:** tính từ `usage_snapshots` 7 ngày gần nhất, chia theo số giờ thực có data (tránh pad 0 cho seat mới)
- **Frontend:** `bld-fleet-kpi-cards.tsx` hoặc component chart tương ứng — đổi label, color, dataKey
- **Subtitle:** "Burn rate 5h và số sessions 7 ngày" → "Burn rate 5h hiện tại vs trung bình 7 ngày"

## Risks
- Seat tạo < 7 ngày: 7d avg lệch → tính theo số giờ thực có data
- Chia 0 khi seat hoàn toàn idle → guard `if hours > 0`
- Cache invalidation nếu có

## Success criteria
- TK Đạt không còn hiển thị bar gây hiểu nhầm khi idle
- Có thể nhìn 1 cái biết seat nào đang spike (xanh > xám rõ rệt)
- Cùng trục, không phá layout hiện tại

## Next
Tạo plan chi tiết qua `/ck:plan`.

## Open questions
- Component nào đang render chart này — `bld-fleet-kpi-cards.tsx` hay file khác? (cần scout khi plan)
- Endpoint cấp data cho chart cụ thể là route nào trong `bld-metrics.ts` / `dashboard.ts`?
