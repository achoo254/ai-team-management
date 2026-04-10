# Phase 3 — Tests + Verify

## Context
- Phase 1 + 2 phải xong
- Vitest workspace có sẵn ở `tests/api/` (node) và `tests/ui/` (jsdom)
- Helper DB in-memory: `tests/helpers/db-helper.ts`

## Priority
HIGH (no test = no merge)

## Status
completed

## Requirements

### Unit tests cho `getDueSeatsForUser`
File: `tests/api/usage-report-per-cycle.test.ts`

Cases:
1. **No watched seats** → return `[]`
2. **Seat ngoài window** (reset_at = now+10h) → not in due
3. **Seat trong window** (reset_at = now+3h) → in due
4. **Seat đã reported cycle này** (`cycle_reported[seat_id] === reset_at`) → skip
5. **Seat reported cycle CŨ** (`cycle_reported[seat_id] !== reset_at`) → in due (chu kỳ mới)
6. **Seat không có snapshot** → skip không crash
7. **Seat snapshot không có `seven_day_resets_at`** → skip

### Unit tests cho `checkAndSendScheduledReports`
Cases:
1. **User report_enabled=false** → không gửi
2. **User no telegram bot** → không gửi
3. **User có 2 seats due** → `sendUserReport` được gọi 1 lần với cả 2 seat IDs
4. **Sau gửi thành công** → `cycle_reported` được update với reset_at
5. **`sendUserReport` throw** → không update `cycle_reported`, log error, không crash loop
6. **2 users độc lập** → 1 user fail không ảnh hưởng user kia

### Unit tests cho `sendUserReport(userId, dueSeatIds?)`
Cases:
1. **No dueSeatIds** → render tất cả watched seats (backward compat — test "Gửi thử")
2. **Có dueSeatIds** → chỉ render seats trong filter
3. **dueSeatIds rỗng `[]`** → return early, không gửi message

Mock: `sendMessageWithBot` để verify call args, không gửi Telegram thật.

## Implementation steps

1. Tạo `tests/api/usage-report-per-cycle.test.ts` theo pattern của tests hiện có
2. Setup in-memory MongoDB qua `db-helper.ts`
3. Seed: 1 user + 2 seats + 2 snapshots với `seven_day_resets_at` khác nhau
4. Mock `sendMessageWithBot` qua `vi.mock`
5. Run các test cases
6. Run `pnpm vitest run tests/api/usage-report-per-cycle.test.ts` → all pass
7. Run full suite `pnpm test` → no regression
8. Manual verify trên dev:
   - `pnpm dev`
   - Bật report_enabled cho user test
   - Set 1 seat snapshot có `seven_day_resets_at = now + 2h`
   - Trigger cron manually (hoặc đợi giờ tròn)
   - Verify nhận Telegram message với đúng seat
   - Verify `cycle_reported` field update trong DB qua `psql`-equivalent (mongo shell)

## Todo list

- [x] Tạo test file
- [x] Implement `getDueSeatsForUser` cases (7)
- [x] Implement `checkAndSendScheduledReports` cases (6)
- [x] Implement `sendUserReport` cases (3)
- [x] Run focused test → pass
- [x] Run full suite `pnpm test` → no regression
- [x] Manual smoke test trên dev
- [x] Verify migration: existing user docs cũ vẫn load OK (mongoose strict ignores extra fields)

## Success criteria
- Tất cả test cases pass
- `pnpm test` không regression
- Manual smoke test: nhận đúng 1 message tại đúng thời điểm, không duplicate
- Build cả workspace pass: `pnpm build`

## Risks
- **R1**: Tests dùng date mocking — cần `vi.useFakeTimers()` để control `now`
- **R2**: Mongoose Map field cần test serialization (toJSON strip)

## Next
→ Update docs nếu có (`docs/system-architecture.md` mục Notification flow)
→ Tạo PR
