# Scout Report: Usage Report Telegram Mechanism

## Tóm tắt
Hệ thống hiện dùng **cron schedule cố định** (schedule: T6/9h) để gửi báo cáo usage. Mỗi seat có trường `seven_day_resets_at` nhưng chưa dùng cho báo cáo.

---

## 1. Cron/Scheduler gửi báo cáo

**File:** `packages/api/src/index.ts:74-77`
```
cron.schedule('0 * * * *', async () => {
  console.log('[Cron] Checking scheduled reports...')
  checkAndSendScheduledReports().catch(console.error)
}, { timezone: 'Asia/Ho_Chi_Minh' })
```
- **Tần suất:** Mỗi giờ (0:00, 1:00, 2:00...)
- **Function:** `checkAndSendScheduledReports()` → `telegram-service.ts:216`

---

## 2. Cơ chế match day/hour

**File:** `packages/api/src/services/telegram-service.ts:216-244`

```typescript
export async function checkAndSendScheduledReports() {
  const now = new Date()
  // Resolve current day (0=Sun..6=Sat) + hour in Asia/Ho_Chi_Minh timezone
  const currentDay = dayMap[parts.weekday] ?? now.getDay()
  const currentHour = Number(parts.hour)

  const users = await User.find({
    'notification_settings.report_enabled': true,
    'notification_settings.report_days': currentDay,        // ← match day
    'notification_settings.report_hour': currentHour,       // ← match hour
    telegram_bot_token: { $ne: null },
    telegram_chat_id: { $ne: null },
  })

  for (const user of users) {
    await sendUserReport(String(user._id))
  }
}
```
- **Query condition:** Tìm users có `report_enabled=true` + day/hour match

---

## 3. User settings model: fields lưu config

**File:** `packages/api/src/models/user.ts:69-72`

```typescript
notification_settings: {
  report_enabled: { type: Boolean, default: false },
  report_days: { type: [Number], default: [5] },      // ← array of 0-6
  report_hour: { type: Number, default: 8 },          // ← 0-23
}
```

**Cập nhật từ endpoint:** `packages/api/src/routes/user-settings.ts:114-129`
- Validate `report_days` là array số 0-6
- Validate `report_hour` là 0-23
- User có thể test báo cáo ngay: `POST /api/user/settings/test-report` (dòng 333)

---

## 4. Model usage_snapshots: reset_at fields

**File:** `packages/api/src/models/usage-snapshot.ts:7-13`

```typescript
interface IUsageSnapshot {
  five_hour_resets_at: Date | null
  seven_day_resets_at: Date | null
  seven_day_sonnet_resets_at: Date | null
  seven_day_opus_resets_at: Date | null
  ...
}
```
- ✅ **Có fields reset_at** cho mỗi quota window
- ⚠️ **Chưa dùng** cho báo cáo (báo cáo dùng cron cố định)

---

## 5. Service gửi báo cáo

**File:** `packages/api/src/services/telegram-service.ts:180-213`

### `sendUserReport(userId)` 
- Lấy tất cả **watched_seats** của user (nếu có) hoặc fallback: owned + assigned seats
- Query **latest snapshot per seat** từ `UsageSnapshot`
- Build HTML report với format đẹp (progress bars, colors 🔴🟡🟢)
- Gửi **1 message duy nhất** chứa tất cả seats via `sendMessageWithBot()`

### Message format
```
📊 Báo cáo Usage — DD/MM/YYYY

── TỔNG QUAN ──────────────
📈 Tận dụng TB 7 ngày: XX%
💸 Lãng phí ước tính: $XXX
...

── CHI TIẾT SEATS ──────────
🔴 Seat_Name (email@...)
   5h:  ▓▓▓░░░░░░░ XX%
   7d:  ▓▓▓▓░░░░░░ XX%
   👥 User1, User2
...

📋 Tổng kết: N seats
```

---

## 6. Báo cáo gộp hay riêng?

**Hiện tại: Gộp 1 message duy nhất**
- Line 179-213: `sendUserReport()` gửi ALL watched seats trong 1 POST request tới Telegram API
- Nếu user watch 10 seats → 1 message với 10 seats

---

## 7. Vấn đề hiện tại & cơ hội

| Vấn đề | Chi tiết | File:Line |
|--------|---------|----------|
| ❌ Schedule cố định | Báo cáo gửi T6/9h regardless of reset | `user.ts:71-72` |
| ✅ Reset time có sẵn | `seven_day_resets_at` trong snapshot | `usage-snapshot.ts:9` |
| ❓ Per-seat report? | Hiện gộp tất, không per-seat | `telegram-service.ts:180-213` |
| 🔧 Cron query flexible | Có thể thay bằng `findScheduledByNextReset()` | `index.ts:74-77` |

---

## Đề xuất: Auto report theo reset_at

1. **Thêm field trong Seat/User:** `next_report_at` (computed từ min(`seven_day_resets_at`))
2. **Cron mới:** Query `next_report_at <= now` thay vì fixed day/hour
3. **Trigger:** Khi seat reset → update `next_report_at` cho user watching it
4. **Format:** Giữ gộp 1 message, nhưng trigger dynamic

**Benefit:** Báo cáo đúng timing khi quota reset, không miss data.

