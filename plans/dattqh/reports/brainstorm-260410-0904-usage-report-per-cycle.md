# Brainstorm — Usage Report Theo Chu Kỳ Reset 7d

**Date:** 2026-04-10
**Status:** Design approved, ready for planning

## Vấn đề

UI hiện tại cho user chọn `report_days` (T6) + `report_hour` (9h) để nhận báo cáo usage qua Telegram bot cá nhân. Cron quét mỗi giờ, match day/hour rồi gửi 1 message gộp tất cả watched seats. Vì mỗi seat có `seven_day_resets_at` khác nhau, tại 1 thời điểm cố định có seat vừa reset (số 0% — vô nghĩa) lẫn seat còn 3 ngày nữa mới reset (chưa phải tổng kết). Báo cáo mất ý nghĩa.

## Hiện trạng (scout findings)

- Cron `0 * * * *` tại `packages/api/src/index.ts:74-77` → `checkAndSendScheduledReports()`
- Match logic tại `packages/api/src/services/telegram-service.ts:216-244`
- User schema `notification_settings.{report_enabled, report_days, report_hour}` tại `packages/api/src/models/user.ts:69-72`
- Field `seven_day_resets_at` đã có sẵn ở `packages/api/src/models/usage-snapshot.ts:7-13` nhưng chưa dùng cho báo cáo
- `sendUserReport(userId)` gửi 1 message gộp tất cả watched seats

## Approaches đã đánh giá

| | A. Per-seat msg | **B. Smart digest** ✅ | C. Hybrid |
|---|---|---|---|
| Trigger | Mỗi seat 1 msg tại reset_at | Gom seats trong cửa sổ 6h | Schedule cũ + auto |
| UX | Spam nhiều msg | 1 msg/đợt như cũ | 2 nguồn — rối |
| Code | Đơn giản | Vừa phải | Phức tạp |
| YAGNI | OK | OK | Vi phạm |

**Chọn B** — giữ pattern "1 message" của UX hiện tại, đơn giản, đáp ứng đúng yêu cầu.

## Quyết định

| Tham số | Giá trị | Lý do |
|---|---|---|
| Window gom seats | **6 giờ** | Cân bằng giữa độ chính xác và spam |
| Lead time | **trước reset 1 giờ** | User thấy số usage cuối chu kỳ trọn vẹn |
| Migration `report_days/hour` | **Drop hoàn toàn** | KISS |

## Flow

```
Cron mỗi giờ (đã có)
  ↓
For each user có report_enabled=true + telegram bot configured:
  due_seats = watched_seats filter:
    seven_day_resets_at ∈ [now + 1h, now + 7h)
    AND cycle_reported[seat_id] !== seat.seven_day_resets_at
  ↓
  Nếu due_seats ≠ ∅:
    sendUserReport(user, only=due_seats)
    cycle_reported[seat_id] = seat.seven_day_resets_at  ∀ seat đã gửi
```

## Thay đổi code

### Schema — `packages/api/src/models/user.ts`
- Drop `notification_settings.report_days`
- Drop `notification_settings.report_hour`
- Thêm `notification_settings.cycle_reported: Map<string, Date>` (key=seat_id)
- Giữ `report_enabled`

### Service — `packages/api/src/services/telegram-service.ts`
- `checkAndSendScheduledReports()`: thay match day/hour bằng query window + dedup
- Cần join `usage_snapshots` lấy snapshot mới nhất per seat → đọc `seven_day_resets_at`
- `sendUserReport(userId, dueSeatsOnly?: string[])`: thêm tham số filter
- `formatUserReport()`: header mới "📊 Báo cáo cuối chu kỳ — N seat sắp reset"

### UI — `packages/web/src/pages/settings.tsx`
- Bỏ chip CN–T7 + dropdown giờ
- Giữ toggle "Đang bật" + nút "Gửi thử"
- Helper text: *"Báo cáo tự gửi trước khi mỗi seat reset chu kỳ 7 ngày (gom trong cửa sổ 6h)."*

### API + DTO — `packages/api/src/routes/user-settings.ts`, `packages/shared/types.ts`
- Bỏ accept `report_days`, `report_hour` trong PATCH payload
- Update validation + DTO

## Edge cases

1. **User vừa bật notification** → chỉ gửi nếu `seven_day_resets_at > now + 1h` (tránh spam tức thì)
2. **Seat mới watch giữa chu kỳ** → `cycle_reported[seat_id]` chưa có → gửi bình thường lần đầu
3. **Cron miss** (downtime) → window 6h cho buffer ~5h tolerance
4. **`seven_day_resets_at` null** → skip seat đó, không crash
5. **"Gửi thử"** → gửi snapshot hiện tại tất cả seats, KHÔNG dedup, KHÔNG update cycle_reported

## Risks

- **R1** Window 6h trễ tới ~5h so với reset thật → tuning sau nếu user phàn nàn
- **R2** Migration `cycle_reported` rỗng lần đầu deploy → có thể gửi 1 lần duplicate → script seed hoặc chấp nhận
- **R3** Query user × snapshot performance → đảm bảo index `usage_snapshots(seat_id, collected_at desc)`

## Success criteria

- Không nhận message khi seat vừa reset (số ~0%)
- Mỗi (user, seat, cycle) nhận báo cáo đúng 1 lần
- Settings UI bỏ 2 control (ngày + giờ)
- "Gửi thử" vẫn hoạt động

## Next steps

→ Tạo implementation plan qua `/ck:plan` với report này làm input.

## Open questions

- Có cần cron bonus chạy gần thời điểm reset (vd `*/15 * * * *`) để tăng độ chính xác không, hay giữ hourly là đủ với window 6h?
- `cycle_reported` lưu trong user document có sợ document phình to khi user watch nhiều seats lâu dài? (mỗi seat 1 entry, replace mỗi cycle → kích thước ổn định)
