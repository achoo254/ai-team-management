# Brainstorm: Schedule + Usage Alert + Bot Config Redesign

**Date:** 2026-04-04
**Status:** Approved for planning

---

## Problem Statement

Hệ thống hiện tại có 3 hạn chế:
1. Schedule chỉ có 2 slot cố định (morning/afternoon) — thiếu linh hoạt
2. Không có per-user usage budget monitoring — user dùng quá mức ảnh hưởng người khác
3. Notification chỉ qua 1 system bot — user không custom được

## Existing Infrastructure (Already Available)

- **UsageSnapshot model**: poll Anthropic API, lưu `five_hour_pct`, `seven_day_pct`, etc. per seat
- **Setting model**: singleton, chứa `alerts.rate_limit_pct` (80%), `alerts.extra_credit_pct` (80%)
- **alert-service.ts**: `checkSnapshotAlerts()` đã query UsageSnapshot + check threshold + tạo alert + Telegram
- **Không cần call thêm Anthropic API** — dùng data UsageSnapshot có sẵn

## Agreed Requirements

### Feature 1: Hourly Recurring Schedule

| Aspect | Decision |
|--------|----------|
| Model | Recurring weekly: `day_of_week` + `start_hour` + `end_hour` + `usage_budget_pct` |
| Overlap | Cho phép, hiển thị warning conflict |
| UX | User tự chọn giờ bất kỳ (0-23), drag-and-drop giữ nguyên |
| Migration | `morning` → `start:8, end:12`, `afternoon` → `start:13, end:17` |

**Schema change:**
```
// OLD
{ seat_id, user_id, day_of_week, slot: 'morning'|'afternoon' }

// NEW
{
  seat_id, user_id, day_of_week,
  start_hour: Number(0-23),
  end_hour: Number(0-23),
  usage_budget_pct: Number(1-100),  // user's allocated budget per session
}
```

**Budget assignment (3 cách, linh hoạt):**
1. **User tự đặt** — khi tạo/sửa schedule slot, nhập budget mong muốn
2. **Admin override** — admin ghi đè budget cho user/slot cụ thể
3. **Auto-divide** — 100% / số user cùng seat trong ngày (fallback khi user không set)

**Overlap detection:** Thay unique index `(seat_id, day_of_week, slot)` bằng application-level check. Query existing schedules cùng seat+day, check `start_hour < existing.end_hour && end_hour > existing.start_hour`. Overlap → warning nhưng vẫn cho tạo.

**UI redesign:**
- Weekly grid: columns = days (Mon-Sun), rows = hours (0-23 hoặc configurable range)
- Time block cards hiển thị user name + duration + budget %
- Drag to create: kéo từ giờ bắt đầu đến giờ kết thúc
- Drag to move: kéo block sang slot khác
- Overlap blocks highlight đỏ/cam
- Total budget indicator per day (VD: 80/100% allocated)

### Feature 2: Per-User Usage Budget Alert + Auto Block

| Aspect | Decision |
|--------|----------|
| Data source | **UsageSnapshot đã có** (không cần call thêm API) |
| Tracking | Delta snapshot: current `five_hour_pct` - session_start `five_hour_pct` |
| Trigger | Bất kỳ window nào (5h, 7d, 7d_sonnet, 7d_opus) vượt budget |
| Action | Alert Telegram + Block UI |
| Unblock | Auto khi next scheduled user's slot bắt đầu |

**Core concept: Usage Budget per Session**
```
5h window = 100% total capacity
├── User A: budget 20% (8h-10h)  → actual delta > 20% → ALERT STOP
├── User B: budget 20% (10h-11h) → actual delta > 20% → ALERT STOP
├── User C: budget 30% (11h-13h) → actual delta > 30% → ALERT STOP
└── Remaining: 30% buffer
```

**Delta tracking mechanism:**
```
Khi session bắt đầu (start_hour = now):
  → Lưu session_start_snapshot = { five_hour_pct, seven_day_pct, ... }

Cron 5min (reuse checkSnapshotAlerts timing):
  → Tìm active sessions (schedule đang diễn ra)
  → Lấy current snapshot
  → delta = current.five_hour_pct - session_start.five_hour_pct
  → if delta >= usage_budget_pct:
     1. Create alert (type: 'usage_exceeded', metadata: { delta, budget, window })
     2. Block seat for current user
     3. Telegram → user: "Bạn đã dùng {delta}% / budget {budget}%, vui lòng stop"
     4. Telegram → next user in schedule: "User trước vượt budget, seat sắp available"
  → Khi next user's slot bắt đầu:
     1. Auto unblock
     2. Resolve alert cũ
     3. Record new session_start_snapshot cho next user
```

**Session start snapshot storage:**
```
// New: ActiveSession (lightweight, transient)
{
  seat_id, user_id, schedule_id,
  started_at: Date,
  snapshot_at_start: {
    five_hour_pct: Number,
    seven_day_pct: Number,
    seven_day_sonnet_pct: Number,
    seven_day_opus_pct: Number,
  }
}
```
Hoặc đơn giản hơn: thêm field `session_start_pct` vào Schedule model (reset mỗi khi session bắt đầu).

**"Next user" logic:**
- Query schedule cùng seat_id, day_of_week = today
- Filter `start_hour > current_hour`
- Sort by start_hour ASC, first = next user

**New alert type:** `'usage_exceeded'` — thêm vào enum (`rate_limit`, `extra_credit`, `token_failure`, `usage_exceeded`)

**UI block:** Dashboard hiển thị badge "OVER BUDGET" trên seat card, disable actions cho user bị block.

### Feature 3: Per-user Telegram Bot Config

| Aspect | Decision |
|--------|----------|
| Scope | Per user |
| Fallback | System bot (env vars) |
| Fields | `telegram_bot_token`, `telegram_chat_id` |

**Schema change (User model):**
```
{
  // existing fields...
  telegram_bot_token?: string,   // encrypted at rest
  telegram_chat_id?: string
}
```

**Notification logic:**
```
function sendToUser(userId, message):
  user = getUser(userId)
  if user.telegram_bot_token && user.telegram_chat_id:
    send via user's bot → user's chat
  else:
    send via system bot → system chat (current behavior)
```

**UI:** Settings section trong profile/settings page. Fields: Bot Token (password input), Chat ID (text input), Test button.

**Security:** Encrypt bot token via `crypto` AES-256-GCM, key from env var.

---

## Architecture Impact

### API Changes
- **Models:** Schedule (redesign: start/end hour + budget), User (add telegram fields)
- **New model/concept:** ActiveSession (track session start snapshot)
- **Routes:** Schedule (rewrite for hourly + budget), new user-settings route
- **Services:** Extend `alert-service` (add `usage_exceeded` type + delta tracking + session management), modify `telegram-service` (per-user bot support)
- **No new cron needed** — extend existing `checkSnapshotAlerts()` flow

### Web Changes
- **Pages:** Schedule (complete rewrite → hourly time grid + budget input), Dashboard (block indicator)
- **Components:** Time-grid schedule component, budget indicator, bot settings form
- **Hooks:** Rewrite use-schedules (new API shape), new use-user-settings

### Shared Changes
- **Types:** Update Schedule type (add start_hour, end_hour, usage_budget_pct), update AlertType enum, add UserSettings type

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| 5h rolling window → delta có thể giảm khi old usage drops off | Medium | Alert trên worst-case window, document behavior cho users |
| Schedule overlap → total budget > 100% | Low | UI warning khi tổng budget/day > 100%, nhưng không block |
| Bot token security | High | Encrypt at rest, never expose in API responses |
| Migration breaking existing schedules | Medium | Script convert morning→8-12, afternoon→13-17, budget=50% |
| Session start detection timing | Medium | Cron 5min → max 5min delay detect session start, acceptable |

## Success Metrics

- User tự tạo/sửa schedule + set budget không cần admin
- Usage delta alert phát hiện vượt budget trong < 10 phút
- Block/unblock tự động hoạt động đúng theo schedule
- Per-user bot notification gửi thành công
- Total budget per seat/day hiển thị rõ ràng trên UI

## Implementation Order (Suggested)

1. **Phase 1:** Schedule model redesign + migration + API + UI (hourly grid + budget)
2. **Phase 2:** Delta tracking + usage_exceeded alert + block/unblock logic
3. **Phase 3:** Per-user bot config + settings UI

Phases ship incrementally. Phase 2 depends on Phase 1 (needs schedule with budget). Phase 3 independent.

---

## Unresolved Questions

1. Có cần "recurring exception" cho ngày lễ không? (Hiện tại: không)
2. Khi 5h rolling window reset → session_start_pct có cần recalibrate không? (Suggest: coi delta < 0 = 0, ignore)
3. Encrypt bot token: dùng `crypto` built-in AES-256-GCM — cần thêm `ENCRYPTION_KEY` env var
