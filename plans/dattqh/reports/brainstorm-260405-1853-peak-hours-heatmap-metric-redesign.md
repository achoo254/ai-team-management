# Peak Hours Heatmap — Metric Redesign

**Date:** 2026-04-05
**Target:** `packages/api/src/routes/dashboard.ts` (peak-hours endpoint) + `packages/web/src/components/dashboard-peak-hours-heatmap.tsx`

## Problem

Heatmap "Giờ cao điểm" hiện dùng metric `avg(delta_7d_pct)` = **tăng trưởng** usage 7 ngày. Sai mục đích:
- User dùng nhiều hôm nay không thấy trên heatmap (window chưa close + delta nhỏ)
- Manager và user thường không hiểu "Δ7d" nghĩa gì
- Chỉ hiện window `is_closed:true` → session đang chạy bị ẩn

## Goal

Heatmap trả lời 1 câu hỏi duy nhất cho **mọi user (không cần kỹ thuật)**:
> "Ngày nào / giờ nào seat bị dùng nhiều (budget 5h cao)?"

## Decision

### Backend (`packages/api/src/routes/dashboard.ts:483-516`)

**Thay đổi aggregate `/peak-hours`:**

```diff
  const grid = await UsageWindow.aggregate([
-   { $match: { is_closed: true, window_end: { $gte: rangeStart }, peak_hour_of_day: { $ne: null }, ...seatFilter } },
+   { $match: { window_end: { $gte: rangeStart }, peak_hour_of_day: { $ne: null }, ...seatFilter } },
    { $addFields: { dow: { $dayOfWeek: { date: '$window_end', timezone: 'Asia/Ho_Chi_Minh' } } } },
    { $group: {
      _id: { dow: '$dow', hour: '$peak_hour_of_day' },
-     avg_delta_7d: { $avg: '$delta_7d_pct' },
+     avg_util: { $avg: '$utilization_pct' },
+     max_util: { $max: '$utilization_pct' },
      window_count: { $sum: 1 },
    }},
    { $project: {
      dow: { $subtract: ['$_id.dow', 1] },
      hour: '$_id.hour', _id: 0,
-     avg_delta_7d: { $round: ['$avg_delta_7d', 1] },
+     avg_util: { $round: ['$avg_util', 1] },
+     max_util: { $round: ['$max_util', 1] },
      window_count: 1,
    }},
  ])
```

**Changes:**
1. Bỏ `is_closed: true` → include open windows (realtime)
2. Đổi `avg_delta_7d` → `avg_util` + `max_util`

### Shared types (`packages/shared/types.ts`)

Update `PeakHourCell`:
```ts
type PeakHourCell = {
  dow: number        // 0-6
  hour: number       // 0-23
  avg_util: number   // % budget 5h trung bình
  max_util: number   // % peak
  window_count: number
}
```

### Frontend (`packages/web/src/components/dashboard-peak-hours-heatmap.tsx`)

**Scale màu cố định 0-100%** (không normalize theo max grid):

```ts
function intensityColor(avgUtil: number): string {
  if (avgUtil <= 0) return "bg-muted/30";
  if (avgUtil < 20) return "bg-red-500/10";
  if (avgUtil < 40) return "bg-red-500/25";
  if (avgUtil < 60) return "bg-red-500/40";
  if (avgUtil < 75) return "bg-red-500/60";
  if (avgUtil < 90) return "bg-red-500/80";
  return "bg-red-500";
}
```

**Tooltip:**
```ts
title={`${label} ${h}h: TB ${avg}% / Peak ${max}% · ${n} sessions`}
```

**Subtitle:**
```tsx
<p>Mức sử dụng budget 5h trung bình theo ngày × giờ (Asia/Ho_Chi_Minh)</p>
```

**Legend:** giữ 3 bậc màu hiện tại nhưng label lại `0%` / `50%` / `100%`.

### Tests

- `tests/api/dashboard.test.ts` — update expectation for new fields.
- Add case: open window (is_closed:false) vẫn xuất hiện trong grid.
- Scale color boundary tests (0, 20, 60, 90, 100).

## Why this solution

| Criteria | How met |
|---|---|
| **KISS** | 1 metric duy nhất, scale 0-100 cố định — không phải học cách đọc |
| **Realtime** | Include open windows → thấy usage hôm nay ngay |
| **Non-technical friendly** | "% sử dụng budget 5h" = concept quen thuộc (như pin điện thoại) |
| **YAGNI** | Bỏ ngưỡng cảnh báo, bỏ max trong màu (chỉ tooltip) |
| **DRY** | Tái dùng `utilization_pct` sẵn có trong `usage_windows` |

## Risks

- **Open window bias**: window mới mở (utilization thấp) kéo avg cell xuống. Mitigation: acceptable — cell sẽ tự chỉnh khi window gần đóng, data 30 ngày đủ smooth.
- **`peak_hour_of_day` của open window thay đổi theo thời gian**: 1 window đang chạy có thể "di chuyển" cell khi peak hour đổi. Mitigation: acceptable — chỉ 1 window/seat mở tại 1 thời điểm, tác động nhỏ so với 30 ngày.

## Success Criteria

- Admin `quocdat254` dùng nhiều hôm nay → thấy cell đỏ ở CN tại giờ hiện tại trong vòng ≤5 phút (1 cron cycle).
- User không kỹ thuật đọc heatmap lần đầu hiểu được mà không cần giải thích.
- Tooltip hiển thị avg/peak/count rõ ràng.

## Next Steps

1. Chạy `/ck:plan` tạo implementation plan chi tiết (1 phase, ~4 file changes).
2. Implement → test → review.

## Unresolved Questions

- Không có. Tất cả quyết định đã chốt.
