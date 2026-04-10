# Brainstorm — Telegram Report Efficiency Reframe

**Date:** 2026-04-10 10:43
**Scope:** Reframe Telegram báo cáo gửi BGĐ từ "cảnh báo rủi ro" → "đo hiệu quả sử dụng quota"
**Decision:** Option B (reframe toàn bộ, mở rộng forecast service)

## Problem

Wording hiện tại trong `packages/api/src/services/telegram-service.ts`:
- L68: `⚠️ X sắp cạn quota 7 ngày — nên cân nhắc đổi tài khoản khác`
- L132: `⚠️ 3 seat(s) > 80% — cần giảm tải!`
- L376: `→ Cần giảm tải hoặc chuyển sang seat khác` (alert cá nhân)

2 vấn đề:
1. **Tone** — imperative + `!` nghe không chuyên nghiệp với BGĐ
2. **Framing sai** — nhìn việc chạm 100% quota như rủi ro, trong khi mục tiêu vận hành là **chạm 100% đúng lúc reset = tối ưu**. Khung hiện tại bỏ sót hoàn toàn case "seat dùng ít → lãng phí quota đã mua" — đây mới là insight chính cho báo cáo BGĐ.

## Insight Mới

Field `seven_day_resets_at` đã có sẵn trong `usage-snapshot.ts` → fixed cycle, có mốc reset cụ thể → tính được efficiency.

**Công thức:**
- `T_full = hours_to_full` (từ quota-forecast-service)
- `T_reset = seven_day_resets_at - now`
- `ratio = T_full / T_reset`

**3 bucket phân loại:**

| Bucket | Điều kiện | Ý nghĩa |
|---|---|---|
| ✅ Tối ưu | `0.85 ≤ ratio ≤ 1.15` | Chạm 100% ≈ đúng lúc reset |
| 🔴 Quá tải | `ratio < 0.85` | Cạn sớm → gián đoạn giữa chu kỳ |
| 🟡 Lãng phí | `ratio > 1.15` hoặc không đạt 100% | Reset trước khi dùng hết → tiền chết |

Ngưỡng ±15% là gợi ý ban đầu, có thể tune.

## Thiết Kế Section "TỔNG QUAN" Mới

```
── HIỆU QUẢ SỬ DỤNG ──────────
✅ Tối ưu:    8 seats  (chạm quota ±15% quanh mốc reset)
🔴 Quá tải:   1 seat   — Seat_A (cạn sớm ~1.8 ngày)
🟡 Lãng phí:  3 seats  — ~$84 quota/chu kỳ không tận dụng
```

**Nguyên tắc wording:**
- Mô tả trạng thái, không ra lệnh
- Không exclamation mark
- Số liệu trước, diễn giải sau
- Lãng phí quy đổi ra $ nếu có cost data; fallback sang %

## Giải Pháp Đã Đánh Giá

| Option | Nội dung | Trade-off | Verdict |
|---|---|---|---|
| A | Chỉ đổi wording 3 dòng | Nhanh (~30p) nhưng insight vẫn sai, vẫn miss case "lãng phí" | ❌ |
| **B** | **Reframe toàn bộ TỔNG QUAN theo 3-bucket + mở rộng forecast service** | **Cần plan, ~nửa ngày. Đúng mục tiêu báo cáo.** | ✅ **Chốt** |
| C | Format business report formal (Rủi ro/Cảnh báo) | Tone OK nhưng vẫn giữ framing cũ | ❌ |

## Scope Thay Đổi Kỹ Thuật

### 1. `packages/api/src/services/quota-forecast-service.ts`
- Thêm compute `projected_utilization_at_reset` cho mỗi seat (pace hiện tại × T_reset)
- Return 3-bucket classification per seat: `'optimal' | 'overload' | 'waste'`
- Compute waste cost nếu có `monthly_cost` trên seat model

### 2. `packages/api/src/services/bld-metrics-service.ts` (hoặc nơi build FleetKpis)
- Extend `FleetKpis` type: `efficiency: { optimal: number; overload: SeatRef[]; waste: { seats: SeatRef[]; waste_usd: number } }`
- Bỏ (hoặc giữ nhưng không dùng cho Telegram) `worstForecast` field cũ

### 3. `packages/api/src/services/telegram-service.ts`
- `buildOverviewSection()` — rewrite L55–71 theo format mới
- `buildReportHtml()` — xoá cảnh báo L131–133 (`3 seat(s) > 80%`), thay bằng reference tới efficiency section
- L376 (alert cá nhân) — **giữ nguyên** tone vì gửi operator, không phải BGĐ
- L68 wording mới: xem section "Thiết Kế" ở trên

### 4. `packages/shared/types.ts`
- Export `SeatEfficiencyBucket` type cho web dashboard tái sử dụng (nếu web cũng cần show)

## Risks

- **Ngưỡng ±15% là guess** — cần chạy báo cáo thực tế 1-2 chu kỳ rồi tune
- **Rolling vs fixed cycle** — nếu `seven_day_resets_at` thực ra là rolling (update liên tục) thì ratio không ổn định. Cần verify trước khi code
- **Waste cost phụ thuộc có cost data** — nếu seat model chưa có `monthly_cost`, phải fallback sang % hoặc tạm hardcode `$20/seat/tháng` (plan cost Claude Max)
- **Seat mới/thiếu data** — seat chưa đủ data để forecast không nên bị phân loại bừa → cần bucket thứ 4 `unknown` hoặc exclude

## Success Metrics

- BGĐ đọc 3 dòng là nắm được: bao nhiêu seat hoạt động tối ưu, bao nhiêu lãng phí, thiệt hại quy đổi $
- Zero imperative + exclamation trong Telegram report
- Efficiency bucketing khớp với nhận định thủ công khi đối chiếu 1-2 chu kỳ đầu

## Next Steps

Nếu approve → invoke `/ck:plan` với context file này để tạo implementation plan chi tiết dưới `plans/dattqh/260410-1043-telegram-report-efficiency-reframe/`.

## Unresolved Questions

1. **Ngưỡng tối ưu** — ±15% / ±10% / ±20%? (đề xuất ±15% làm default, tune sau)
2. **Cost data** — `seat` model đã có field `monthly_cost` chưa? Nếu chưa, fallback hiển thị % hay hardcode $20?
3. **7d window là fixed hay rolling?** — field `seven_day_resets_at` gợi ý fixed, cần verify bằng cách xem `usage-collector-service.ts` parse từ upstream Anthropic API ntn
4. **Seat thiếu data** — classify thế nào? (đề xuất: exclude khỏi 3-bucket, show riêng `⏸ Chưa đủ dữ liệu: N seats`)
5. **Alert cá nhân L376** — xác nhận giữ nguyên (gửi operator, không phải BGĐ)?
