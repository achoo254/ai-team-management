# Phase 4 — Frontend Redesign Card

## Overview
**Priority:** High · **Status:** pending
Redesign `dashboard-efficiency.tsx` với layout mới, thêm `QuotaForecastBar` component.

## Related files
- **Modify:** `packages/web/src/components/dashboard-efficiency.tsx`
- **Create:** `packages/web/src/components/quota-forecast-bar.tsx`
- **Read:** `packages/shared/types.ts` (Phase 3)

## Layout target
```
Hiệu suất sử dụng        29/03 - 05/04 · [1 phiên đang mở]
─────────────────────────────────────────────────────────
  7/10          38h           10           37%
Phiên hiệu quả  Tổng giờ dùng  Tổng phiên  Mức dùng TB

 Quota 7d (seat TK Đạt sẽ hết sớm nhất)
 ■■■□□□□□□□□□  15%  pace +3%/h
 🔴 Dự báo hết: Thứ 5 07/04 ~14:30 (còn ~28h)

 Quota 5h (phiên hiện tại)
 ■□□□□□□□□□□□  8%   ✅ Còn nhiều

Phiên đang chạy
  TK Đạt     Dùng 8% phiên · tốn 0% quota tuần

Theo người dùng
  Admin      10 phiên · 38h · hiệu quả 37% [TB]
```

## Components

### `QuotaForecastBar` (new)
Props: `{ type: "7d" | "5h", data: QuotaForecast['seven_day'] | QuotaForecast['five_hour'] }`
- Render progress bar với màu theo status
- 7d mode: show pace + forecast line khi status != safe/collecting
- 5h mode: show % + status label

### `getUserBadge(utilization: number)`
- `>=60` → `{label: "Tốt", variant: "default"}`
- `30-60` → `{label: "TB", variant: "secondary"}`
- `<30` → `{label: "Thấp", variant: "outline"}`

### Status → color map
| Status | Color | Emoji |
|---|---|---|
| safe, safe_decreasing | green | ✅ |
| watch | amber | 🟡 |
| warning | orange | 🟠 |
| critical | red | 🔴 |
| imminent | red pulsing | 🚨 |
| collecting | muted | ⏳ |

### Date formatting (Vietnamese)
- Helper `formatForecastDate(isoString: string): string`
- Output: `"Thứ 5 07/04 ~14:30"`
- Dùng `Intl.DateTimeFormat('vi-VN', ...)` hoặc existing formatter trong codebase

## Changes to top-level card
- Replace 4-stat grid với: Phiên hiệu quả, Tổng giờ, Tổng phiên, Mức dùng TB
- Replace 2-stat Sonnet/Opus với 2× `QuotaForecastBar`
- Session đang chạy: relabel "Util" → "Dùng {X}% phiên", "Δ7d" → "tốn {Y}% quota tuần"
- Per-user: append badge từ `getUserBadge`

## Todo
- [ ] Create `quota-forecast-bar.tsx` (<100 LOC)
- [ ] Add `formatForecastDate` helper
- [ ] Add `getUserBadge` helper (inline hoặc utils.ts)
- [ ] Refactor `dashboard-efficiency.tsx`:
  - [ ] New top 4-stat grid
  - [ ] Swap Sonnet/Opus box → 2× QuotaForecastBar
  - [ ] Relabel session đang chạy
  - [ ] Add badge per-user
- [ ] Remove unused imports/props
- [ ] Ensure file <200 LOC

## Success criteria
- Visual match layout target
- Responsive: mobile 2-col grid fallback
- Build pass (`pnpm -F @repo/web build`)
- Dark mode compatible

## Risks
- `QuotaForecast` có thể null (no active seats) → UI handle empty state với placeholder
- Long seat label break layout → truncate với `max-w` + tooltip
