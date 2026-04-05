---
name: alert-per-seat-thresholds
status: pending
created: 2026-04-05
slug: alert-per-seat-thresholds
blockedBy: []
blocks: []
---

# Alert Per-Seat Thresholds Refactor

## Problem

Hiện tại user có 1 bộ threshold global (`rate_limit_pct`, `extra_credit_pct`) áp cho mọi watched seat. Không phản ánh đặc thù từng seat (seat chạy dev khác seat chạy prod). Mong muốn: mỗi user config threshold riêng cho từng seat họ watch.

## Goals

- Tách **channel config** (ở user level) khỏi **threshold config** (per-user-per-seat).
- Thresholds riêng cho 5h window và 7d window.
- Bỏ concept `extra_credit` riêng.
- UI thân thiện: config threshold ngay trên seat card.

## Design Summary

| Layer | Before | After |
|---|---|---|
| User.alert_settings | channels + rate_limit_pct + extra_credit_pct | channels only (enabled, telegram/desktop toggles, token_failure toggle) |
| User.watched_seat_ids | `ObjectId[]` | `watched_seats: [{seat_id, threshold_5h_pct, threshold_7d_pct}]` |
| Alert.dedup | (seat, type) per 24h | (user, seat, type, window) per 24h |
| Alert types | rate_limit, extra_credit, token_failure, usage_exceeded, session_waste, 7d_risk | rate_limit, token_failure, usage_exceeded, session_waste, 7d_risk (drop extra_credit) |

**Threshold semantics:**
- `threshold_5h_pct` → compared vs `snapshot.five_hour_pct`
- `threshold_7d_pct` → compared vs `max(seven_day_pct, seven_day_sonnet_pct, seven_day_opus_pct)`
- Alert metadata ghi rõ window nào vượt.

**Defaults khi user watch seat mới:** 5h = 90%, 7d = 85%.

**Migration:** Clean slate — xoá `rate_limit_pct`, `extra_credit_pct`; convert `watched_seat_ids` → `watched_seats: []`. Users phải re-watch + config lại. Banner onboarding hiển thị.

## Phases

| # | Phase | Status |
|---|---|---|
| 01 | [Backend Schema + Migration](phase-01-backend-schema-migration.md) | pending |
| 02 | [Backend Alert Service + API](phase-02-backend-alert-service.md) | pending |
| 03 | [Frontend Alert Settings (Channels)](phase-03-frontend-alert-settings.md) | pending |
| 04 | [Frontend Per-Seat Watch Config UI](phase-04-frontend-watch-config-ui.md) | pending |
| 05 | [Testing + Docs](phase-05-testing.md) | pending |

## Key Dependencies

- Phase 02 depends on Phase 01 (schema)
- Phase 03 & 04 depend on Phase 02 (API)
- Phase 05 depends on all

## Success Criteria

- User có thể watch 1 seat với threshold 5h=80%, 7d=70% và seat khác với 5h=95%, 7d=90%.
- Alert chỉ fire cho users có threshold bị vượt.
- Không có regression cho token_failure, usage_exceeded, session_waste, 7d_risk alerts.
- UI intuitive: watch/unwatch + edit thresholds trong < 2 clicks.
- All existing tests pass + new tests cover per-user dedup logic.
