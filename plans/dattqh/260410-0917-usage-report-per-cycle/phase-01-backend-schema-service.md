# Phase 1 — Backend: Schema + Service

## Context
- Brainstorm: `../reports/brainstorm-260410-0904-usage-report-per-cycle.md`
- Files đụng tới:
  - `packages/api/src/models/user.ts:3-7,69-73` — schema migration
  - `packages/api/src/services/telegram-service.ts:180-244` — cron + sendUserReport
  - `packages/api/src/routes/user-settings.ts` — DTO accept
  - `packages/shared/types.ts` — DTO type

## Priority
HIGH — phải xong trước Phase 2 (UI dùng API)

## Status
completed

## Key insights
- `seven_day_resets_at` đã có sẵn trong `usage-snapshot.ts:7-13` (không cần migration field này)
- Cron `0 * * * *` đã có ở `index.ts:74-77` → KHÔNG đụng cron, chỉ đổi nội dung function
- `sendUserReport()` hiện auto detect watched seats → cần thêm tham số `dueSeatIds?: string[]` để filter
- Encryption check `isEncryptionConfigured()` đã có — giữ nguyên

## Requirements

### Functional
- Drop `notification_settings.report_days` + `report_hour` khỏi schema và DTO
- Thêm `notification_settings.cycle_reported: Map<string, Date>` (key = seat_id)
- `checkAndSendScheduledReports()` query mới:
  ```
  users with notification_settings.report_enabled=true + telegram bot configured
    AND có ≥1 watched_seat thoả:
      latest_snapshot.seven_day_resets_at ∈ [now+1h, now+7h)
      AND cycle_reported[seat_id] !== that reset_at
  ```
- `sendUserReport(userId, dueSeatIds?)`: nếu có `dueSeatIds`, chỉ render seats trong danh sách đó
- Sau khi gửi thành công: update `cycle_reported[seat_id] = reset_at` cho mỗi seat đã gửi

### Non-functional
- Query phải tận dụng index `usage_snapshots(seat_id, collected_at desc)` — verify đã có, thêm nếu chưa
- Không break test "Gửi thử" → manual trigger gọi `sendUserReport(userId)` không truyền `dueSeatIds` + KHÔNG update `cycle_reported`

## Architecture

### Schema diff (`user.ts`)
```ts
export interface INotificationSettings {
  report_enabled: boolean
  // REMOVED: report_days, report_hour
  cycle_reported?: Map<string, Date>  // key=seat_id (string), value=reset_at đã gửi
}

// Schema:
notification_settings: {
  report_enabled: { type: Boolean, default: false },
  cycle_reported: { type: Map, of: Date, default: () => new Map() },
}
```

### Service flow (`telegram-service.ts`)

```ts
// New helper: lấy seats đến hạn cho 1 user
async function getDueSeatsForUser(user: IUser, windowStart: Date, windowEnd: Date): Promise<string[]> {
  const watchedIds = (user.watched_seats ?? []).map(w => String(w.seat_id))
  if (watchedIds.length === 0) return []

  // Lấy snapshot mới nhất per seat
  const snaps = await UsageSnapshot.aggregate([
    { $match: { seat_id: { $in: watchedIds.map(id => new Types.ObjectId(id)) } } },
    { $sort: { collected_at: -1 } },
    { $group: { _id: '$seat_id', seven_day_resets_at: { $first: '$seven_day_resets_at' } } },
  ])

  const cycleReported = user.notification_settings?.cycle_reported ?? new Map()
  const due: string[] = []
  for (const snap of snaps) {
    const resetAt = snap.seven_day_resets_at
    if (!resetAt) continue
    if (resetAt < windowStart || resetAt >= windowEnd) continue
    const seatIdStr = String(snap._id)
    const lastReported = cycleReported.get(seatIdStr)
    if (lastReported && lastReported.getTime() === resetAt.getTime()) continue
    due.push(seatIdStr)
  }
  return due
}

// Updated cron handler
export async function checkAndSendScheduledReports() {
  const now = new Date()
  const windowStart = new Date(now.getTime() + 1 * 3600_000)  // +1h lead
  const windowEnd = new Date(now.getTime() + 7 * 3600_000)    // +7h (lead + 6h window)

  const users = await User.find({
    'notification_settings.report_enabled': true,
    telegram_bot_token: { $ne: null },
    telegram_chat_id: { $ne: null },
  })

  for (const user of users) {
    try {
      const dueSeatIds = await getDueSeatsForUser(user, windowStart, windowEnd)
      if (dueSeatIds.length === 0) continue

      await sendUserReport(String(user._id), dueSeatIds)

      // Update cycle_reported with reset_at values
      const snaps = await UsageSnapshot.aggregate([...]) // re-fetch hoặc pass từ getDueSeatsForUser
      for (const snap of snaps) {
        if (dueSeatIds.includes(String(snap._id))) {
          user.notification_settings!.cycle_reported!.set(String(snap._id), snap.seven_day_resets_at)
        }
      }
      await user.save()
      console.log(`[Scheduler] Sent report to ${user.name} for ${dueSeatIds.length} seats`)
    } catch (err) {
      console.error(`[Scheduler] Failed for ${user.name}:`, err)
    }
  }
}
```

**Optimization:** `getDueSeatsForUser` nên trả về cả `Map<seatId, resetAt>` để tránh re-query — return shape: `{ dueSeatIds: string[], resetMap: Map<string, Date> }`.

### `sendUserReport` change
```ts
export async function sendUserReport(userId: string, dueSeatIds?: string[]) {
  // ... existing logic to load user, watched seats, etc
  let seats = /* ... existing seat loading */

  // NEW: filter if dueSeatIds passed
  if (dueSeatIds && dueSeatIds.length > 0) {
    const dueSet = new Set(dueSeatIds)
    seats = seats.filter((s: any) => dueSet.has(String(s._id)))
  }

  if (seats.length === 0) return
  // ... rest unchanged
}
```

## Related code files

**Modify:**
- `packages/api/src/models/user.ts` — schema + interface
- `packages/api/src/services/telegram-service.ts` — `checkAndSendScheduledReports`, `sendUserReport`, new helper `getDueSeatsForUser`
- `packages/api/src/routes/user-settings.ts` — bỏ `report_days/report_hour` khỏi accepted payload
- `packages/shared/types.ts` — DTO `NotificationSettingsDto` update

**Read for context:**
- `packages/api/src/models/usage-snapshot.ts:7-13` — confirm field name `seven_day_resets_at`
- `packages/api/src/index.ts:74-77` — confirm cron schedule không đổi

## Implementation steps

1. Update `INotificationSettings` interface và schema definition trong `user.ts`
2. Update `NotificationSettingsDto` trong `packages/shared/types.ts`
3. Update `user-settings.ts` route — bỏ validation cho `report_days/report_hour`
4. Add `getDueSeatsForUser()` helper trong `telegram-service.ts`
5. Rewrite `checkAndSendScheduledReports()` dùng helper mới
6. Add tham số `dueSeatIds?` cho `sendUserReport()`
7. Run `pnpm -F @repo/api build` để check typecheck
8. Verify cron `0 * * * *` trong `index.ts` không thay đổi
9. Verify index `usage_snapshots(seat_id, collected_at: -1)` đã có trong model definition; thêm nếu chưa

## Todo list

- [x] Update `user.ts` schema
- [x] Update `types.ts` DTO
- [x] Update `user-settings.ts` route validation
- [x] Add `getDueSeatsForUser()` helper
- [x] Rewrite `checkAndSendScheduledReports()`
- [x] Add `dueSeatIds?` param vào `sendUserReport()`
- [x] Verify index trên `usage_snapshots`
- [x] `pnpm -F @repo/api build` pass

## Success criteria
- Typecheck pass
- Schema không còn `report_days`, `report_hour`
- Cron mới query đúng + dedup hoạt động qua `cycle_reported`
- Gọi `sendUserReport(userId)` (không có `dueSeatIds`) vẫn gửi tất cả watched seats như cũ → "Gửi thử" hoạt động

## Risks

- **R1 — Migration data cũ**: user document cũ có `report_days/report_hour` → mongoose strict mode có thể warn. Mongoose mặc định strict=true sẽ ignore field không định nghĩa. OK.
- **R2 — `cycle_reported` lần đầu rỗng**: deploy xong, cron đầu tiên có thể gửi seat đang trong window mà trước đó user đã nhận. Mitigation: chấp nhận 1 lần "duplicate" hoặc seed script. → Để vào Phase 3 verify.
- **R3 — Aggregate query chậm**: nếu nhiều users + nhiều snapshots. Mitigation: index sẵn, batch query khả thi sau.
- **R4 — Map serialization**: Mongoose Map type cần `toJSON` transform nếu expose qua API. Hiện UI không cần đọc `cycle_reported` → có thể strip trong `toJSON` transform giống `telegram_bot_token`.

## Security
- Không touch crypto/auth
- `cycle_reported` không phải PII nhạy cảm nhưng nên strip khỏi API response (thêm vào `toJSON` transform của user.ts)

## Next
→ Phase 2 (UI cleanup) sau khi Phase 1 build pass
