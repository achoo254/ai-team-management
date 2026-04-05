# Brainstorm: Tại sao "Hiệu suất sử dụng" không có data

**Date:** 2026-04-05  
**Status:** Analysis complete

## Vấn đề

Card "Hiệu suất sử dụng" trên Dashboard luôn hiển thị "Chưa có dữ liệu session" dù đã deploy vài tiếng, reset session 5h nhiều lần.

## Root Cause

`DashboardEfficiency` component (`dashboard-efficiency.tsx:30`) check `total_sessions === 0` → hiển thị empty state. Data đến từ collection `session_metrics` qua endpoint `GET /api/dashboard/efficiency`.

**`SessionMetric` chỉ được tạo khi session schedule KẾT THÚC** — không phải khi user sử dụng hay reset.

### Luồng tạo data

```
Cron 5min → checkBudgetAlerts() → tìm active schedules
  → Tạo ActiveSession (phiên đang chạy, lưu snapshot baseline)
  → Detect 5h resets, tính delta
  → Khi schedule hết giờ (end_hour ≤ currentHour):
      cleanupExpiredSessions() → persistSessionMetric() → SessionMetric.create()
```

**Files liên quan:**
- `packages/api/src/services/alert-service.ts:341-399` — `cleanupExpiredSessions()` + `persistSessionMetric()`
- `packages/api/src/models/session-metric.ts` — schema
- `packages/api/src/routes/dashboard.ts:313-427` — `/efficiency` endpoint
- `packages/web/src/components/dashboard-efficiency.tsx` — UI component
- `packages/web/src/hooks/use-dashboard.ts:157-165` — `useEfficiency()` hook

### 3 điều kiện bắt buộc để có data

| # | Điều kiện | Mô tả |
|---|-----------|-------|
| 1 | Schedule tồn tại | Phải có schedule entries (lịch phân ca) cho seat + user + đúng ngày/giờ |
| 2 | Cron chạy trong giờ active | Cron 5-phút phải trigger trong khoảng `start_hour ≤ now < end_hour` để tạo `ActiveSession` |
| 3 | Schedule kết thúc | `end_hour ≤ currentHour` → `cleanupExpiredSessions()` persist metric rồi xóa `ActiveSession` |

### Tại sao reset session 5h không tạo data

Reset session 5h chỉ tăng counter `reset_count_5h` trên `ActiveSession` — KHÔNG persist `SessionMetric`. Metric chỉ ghi khi schedule hết giờ.

## Kiểm tra cần làm

1. Query `schedules` collection xem có entries cho hôm nay không
2. Query `active_sessions` xem có phiên đang chạy không
3. Query `session_metrics` confirm rỗng
4. Check cron job logs xem `checkBudgetAlerts()` có chạy không

## Unresolved Questions

- Có schedules nào đã được tạo trên hệ thống chưa?
- Cron job có đang chạy bình thường không? (check logs)
- Nếu không muốn phụ thuộc schedules, có nên tạo metric từ usage snapshots trực tiếp?
