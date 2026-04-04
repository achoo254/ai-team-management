# Brainstorm: Refactor Alert Settings → User Settings

## Problem Statement
Alert settings (thresholds + telegram bot) hiện nằm ở Admin page, gửi notification cho tất cả seats qua system bot. Cần refactor để mỗi user tự quản lý alert settings riêng, chọn seats muốn nhận thông báo.

## Decisions

| Decision | Choice |
|----------|--------|
| Thresholds | Per-user (mỗi user tự set) |
| System bot | Xoá hoàn toàn, chỉ dùng personal bot |
| Notify logic | Chỉ user đã subscribe seat đó |
| UI Layout | Section mới "Cài đặt Alert" trong Settings page |

## Design

### Database
- **User model** thêm `alert_settings: { enabled, rate_limit_pct, extra_credit_pct, subscribed_seat_ids[] }`
- **Settings model** xoá `telegram` + `alerts` fields (hoặc xoá model nếu trống)

### API
- Xoá/strip `GET/PUT /api/settings` (telegram + alert fields)
- Mở rộng `GET/PUT /api/user/settings` thêm `alert_settings` + `available_seats[]`
- Available seats: user thường → chỉ seat_ids của mình, admin → tất cả

### Alert Service
- Loop users subscribed to seat → check per-user threshold → gửi qua personal bot
- Không có personal bot → skip (silent)
- Bỏ system bot fallback hoàn toàn

### Frontend
- **Admin page**: Xoá section Alert thresholds + Telegram Bot config
- **Settings page**: Thêm section "Cài đặt Alert" với toggle, threshold inputs, seat multi-select
- **New component**: `alert-settings-form.tsx`

### Migration
- Default `alert_settings`: enabled=false, thresholds=80/80, subscribed_seat_ids=[]
- Admin tự configure lại sau deploy

### Code Removal
- `models/setting.ts` — strip hoặc xoá
- Admin page alert/telegram UI sections
- `telegram-service.ts` — bỏ system bot logic
- `use-admin.ts` — bỏ settings mutations

## Risks
- Users không configure bot → không nhận alert nào (acceptable, user's choice)
- Migration: admin mất config cũ, cần reconfigure

## Next Steps
→ Tạo implementation plan chi tiết
