# Phase 6: Alerts & Notifications

**Priority:** Medium | **Status:** pending | **Effort:** 0.5 day

## Overview
Hệ thống cảnh báo khi usage cao hoặc bất thường.

## Alert Rules

| Rule | Trigger | Severity |
|------|---------|----------|
| High daily usage | 1 seat dùng >$2 trong 1 ngày | Warning |
| Weekly pace | Extrapolated weekly cost >$15/seat | Warning |
| Session spike | >10 sessions/day cho 1 seat | Info |
| No activity | Seat không có activity >3 ngày | Info |

## Implementation

### alert-service.js
- Chạy sau mỗi lần sync (daily)
- Check usage_logs vs thresholds
- Insert alert record nếu trigger
- Dedup: không tạo alert trùng cùng ngày

### Dashboard Integration
- Alert badge trên navigation bar
- Toast notification khi có alert mới
- Alert history page

## Implementation Steps
- [ ] Create `server/services/alert-service.js` — rule engine
- [ ] Define configurable thresholds in `server/config.js`
- [ ] Hook alert check after daily sync
- [ ] Add alert badge + toast in frontend
- [ ] Admin resolve flow

## Success Criteria
- Alerts generated correctly based on rules
- No duplicate alerts same day
- Admin can resolve alerts
- Badge shows unresolved count
