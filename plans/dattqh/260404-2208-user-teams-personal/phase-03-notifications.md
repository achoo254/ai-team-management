# Phase 3: Notification Integration

**Status:** pending | **Priority:** medium | **Effort:** M
**Depends on:** Phase 2

## Goal
Mọi action do admin/team-owner tác động user khác → gửi notification qua channels user đã config (telegram, FCM push, in-app).

## Related Files
**Modify:**
- `packages/api/src/services/alert-service.ts` — add team event emitters
- `packages/api/src/services/telegram-service.ts` — add team event messages
- `packages/api/src/routes/teams.ts` — call notification emitters after actions

## Event Types

| Event | Target | Trigger |
|---|---|---|
| `team.member_added` | user bị add | Owner/admin add user vào team |
| `team.member_removed` | user bị remove | Owner/admin remove user khỏi team |
| `team.seat_reassigned` | seat owner | Admin change seat.team_id của seat người khác |
| `team.deleted_by_admin` | team creator | Admin xóa team của user |
| `team.updated_by_admin` | team creator | Admin edit team của user |

## Implementation Steps

### 1. Extend `alert-service.ts` với helper emit
```ts
export async function emitTeamEvent(params: {
  event_type: string,
  actor_id: string,     // ai thực hiện action
  target_user_id: string, // ai nhận notify
  team_id: string,
  extra?: Record<string, any>
}) {
  // Skip if actor === target (self-action, no notify)
  if (params.actor_id === params.target_user_id) return
  // Create in-app notification record
  // Call telegram if user enabled
  // Call FCM push if user enabled
}
```

Reuse channel dispatch logic từ alert system (commit 723ad87).

### 2. Telegram message templates (`telegram-service.ts`)
```
member_added:   "✅ {actor} đã thêm bạn vào team {team_label}"
member_removed: "❌ {actor} đã xóa bạn khỏi team {team_label}"
seat_reassigned:"🔄 Admin đã chuyển seat {seat_email} sang team {team_label}"
deleted_by_admin:"🗑️ Admin đã xóa team {team_label} do bạn tạo"
updated_by_admin:"✏️ Admin đã chỉnh sửa team {team_label} do bạn tạo"
```

### 3. FCM push (reuse existing sender)
- Title: event short name
- Body: same as telegram template
- Data: `{ type: 'team', team_id, event_type }`

### 4. In-app notification (reuse notification bell infra)
- Insert vào notifications collection (hoặc alerts collection nếu chung)
- Badge count tăng

### 5. Wire emitters vào routes
```ts
// teams.ts — example
router.post('/:id/members', authenticate, requireTeamOwnerOrAdmin, async (req, res) => {
  // ... add user to team
  await emitTeamEvent({
    event_type: 'team.member_added',
    actor_id: req.user._id,
    target_user_id: req.body.user_id,
    team_id: req.params.id,
  })
  res.json(...)
})
```

### 6. Channel respect user settings
Check `user.notification_settings` (existing):
- `telegram_enabled` → send telegram
- `fcm_enabled` → send FCM
- In-app → always on

## Todo
- [ ] Audit existing notification dispatch helpers (reuse, không duplicate)
- [ ] Add emitTeamEvent helper
- [ ] Add telegram templates
- [ ] Wire emitters vào teams.ts routes
- [ ] Wire emitter vào seats.ts (seat_reassigned)
- [ ] Test manual: admin edit user team → verify 3 channels fire

## Success Criteria
- User A add user B → B nhận notify (không notify A)
- Admin xóa team của C → C nhận notify
- User disable telegram → không spam telegram nhưng vẫn có in-app
- Self-action không trigger notify

## Risks
- Notification spam nếu bulk action → consider batching (YAGNI — skip for now)
- Channels async không block response → fire-and-forget pattern
