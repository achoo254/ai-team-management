# Phase 3 — UI Wiring (4 components)

## Overview
**Priority:** High · **Status:** completed
Consume `formatResetTime` helper across 4 dashboard surfaces.

## Related files
- **Modify:** `packages/web/src/components/quota-forecast-bar.tsx`
- **Modify:** `packages/web/src/components/dashboard-detail-table.tsx`
- **Modify:** `packages/web/src/components/dashboard-seat-usage-chart.tsx`
- **Modify:** `packages/web/src/components/dashboard-stat-overview.tsx`
- **Read:** `packages/web/src/lib/format-reset.ts` (Phase 1)

## Changes

### 1. `quota-forecast-bar.tsx`
Thêm 1 line dưới forecast line cho cả 7d + 5h bar:
```tsx
{data.resets_at && (
  <p className="text-[11px] text-muted-foreground">
    ↻ Reset định kỳ: {formatResetTime(data.resets_at).label}
  </p>
)}
```
Áp dụng cho cả 2 branches (7d props + 5h props).

### 2. `dashboard-detail-table.tsx`
Wrap `pctCell` trong `Tooltip` (from `@/components/ui/tooltip`):
```tsx
<Tooltip>
  <TooltipTrigger asChild>
    <span>{pctCell(s.five_hour_pct)}</span>
  </TooltipTrigger>
  <TooltipContent>
    Reset: {formatResetTime(s.five_hour_resets_at).label}
  </TooltipContent>
</Tooltip>
```
Same pattern cho 7d cell.

### 3. `dashboard-seat-usage-chart.tsx`
Extend tooltip custom render (currently shows `TooltipRow label="5h" value={seat?.five_hour_pct}`):
- Thêm sub-line nhỏ dưới mỗi row: `↻ {formatResetTime(seat?.five_hour_resets_at).label}`
- Wrap trong conditional để skip nếu null (trả `—` từ helper).

### 4. `dashboard-stat-overview.tsx`
Dưới 2 stat card `TB 5h` / `TB 7d`, tính soonest reset:
```tsx
const soonest5h = Math.min(...seats
  .map(s => s.five_hour_resets_at ? new Date(s.five_hour_resets_at).getTime() : Infinity))
const soonest5hIso = soonest5h === Infinity ? null : new Date(soonest5h).toISOString()
// render: "Reset sớm nhất: {formatResetTime(soonest5hIso).label}"
```

## Todo
- [ ] Edit `quota-forecast-bar.tsx` — add reset line for both types (requires Phase 2 API)
- [ ] Edit `dashboard-detail-table.tsx` — wrap pctCell with Tooltip
- [ ] Edit `dashboard-seat-usage-chart.tsx` — extend TooltipRow with reset sub-line
- [ ] Edit `dashboard-stat-overview.tsx` — compute soonest reset per stat
- [ ] Verify all files <200 LOC
- [ ] Run `pnpm -F @repo/web exec tsc --noEmit`
- [ ] Manual smoke: dashboard renders reset labels correctly

## Success criteria
- Reset time visible ở 4 surfaces
- Format identical (cùng helper)
- Null → `—` stable layout
- Past → `Đang chờ cập nhật`
- Imminent (<5min) → highlighted label
- Typecheck clean + existing tests pass

## Risks
- Tooltip trong table có thể conflict với cell sort click — dùng `asChild` + preventDefault nếu cần
- Mobile: tooltip không hoạt động với touch → consider `onClick` toggle hoặc chấp nhận desktop-first
- `Infinity` comparison cần guard trước khi `new Date()`
