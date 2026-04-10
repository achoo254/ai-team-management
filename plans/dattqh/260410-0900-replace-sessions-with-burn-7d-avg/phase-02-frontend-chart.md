# Phase 02 — Frontend: Modify dashboard-seat-efficiency.tsx

## Goal
Thay metric `Sessions (7d)` bằng `Burn 7d avg (%/h)`. Tính 100% client-side, không đụng backend.

## File
`packages/web/src/components/dashboard-seat-efficiency.tsx`

## Steps

### 1. Thêm helper `calcBurnRate7d` (cạnh `calcBurnRate5h` line 15-28)
```ts
/** Compute 7d burn rate (%/h) from current pct and time into 7-day window */
function calcBurnRate7d(seat: SeatUsageItem): number {
  if (seat.seven_day_pct == null || seat.seven_day_pct <= 0) return 0;
  if (!seat.seven_day_resets_at) return 0;

  const resetsAt = new Date(seat.seven_day_resets_at).getTime();
  const now = Date.now();
  const windowMs = 7 * 24 * 60 * 60 * 1000;
  const windowStart = resetsAt - windowMs;

  if (now < windowStart || now > resetsAt) return 0;

  const hoursElapsed = Math.max(1, (now - windowStart) / (60 * 60 * 1000));
  return Math.round((seat.seven_day_pct / hoursElapsed) * 10) / 10;
}
```

### 2. Update `calcChartData` (line 30-37)
```ts
function calcChartData(seat: SeatUsageItem) {
  return {
    label: seat.label,
    burn_rate: calcBurnRate5h(seat),
    burn_7d_avg: calcBurnRate7d(seat),  // was: sessions: seat.session_count_7d
  };
}
```

### 3. Update `sessionColor` → `baselineColor` (line 49-51)
```ts
/** Baseline (7d avg) color — neutral muted, contrasts with current burn */
function baselineColor(): string {
  return cssVar("--muted-foreground");
}
```

### 4. Rename `SessionLabel` → `BaselineLabel` (line 71-85)
```tsx
function BaselineLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value == null || value === 0) return null;
  return (
    <text
      x={x + width + 4}
      y={y + height / 2}
      dy={4}
      textAnchor="start"
      style={{ fontSize: 10, fontWeight: 600, fill: baselineColor() }}
    >
      {value}%/h
    </text>
  );
}
```

### 5. Update tooltip (line 89-103)
```tsx
<TRow label="Burn rate 5h" value={`${d.burn_rate}%/h`} color={burnRateColor(d.burn_rate)} />
<TRow label="Burn 7d avg" value={`${d.burn_7d_avg}%/h`} color={baselineColor()} />
```

### 6. Update legend (line 116-129)
```tsx
<span>Burn rate 5h (%/h)</span>
// ...
<span>Burn 7d avg (%/h)</span>
```

### 7. Update subtitle (line 154-156)
```tsx
<p className="text-xs text-muted-foreground mt-0.5">
  Burn 5h hiện tại vs trung bình 7 ngày · <span className="font-medium">{formatRangeDate(range)}</span>
</p>
```

### 8. Update xMax calc (line 142-144)
```ts
const maxBurn5h = Math.max(...chartData.map((d) => d.burn_rate), 10);
const maxBurn7d = Math.max(...chartData.map((d) => d.burn_7d_avg), 10);
const xMax = Math.max(maxBurn5h, maxBurn7d);
```

### 9. Update Bar 2 (line 209-220)
```tsx
<Bar
  dataKey="burn_7d_avg"  // was: "sessions"
  name="Burn 7d avg"      // was: "Sessions 7d"
  maxBarSize={barSize}
  radius={[0, 4, 4, 0]}
>
  {chartData.map((d, i) => (
    <Cell key={i} fill={baselineColor()} fillOpacity={0.8} />
  ))}
  <LabelList content={<BaselineLabel />} />
</Bar>
```

### 10. Compile + smoke test
```bash
pnpm -F @repo/web build
pnpm dev:web   # mở http://localhost:5173 → Dashboard tab → check chart
```

## Edge cases handled by helpers
- `seven_day_pct == null` → 0
- `seven_day_resets_at == null` → 0
- now ngoài window → 0
- min hoursElapsed = 1 (tránh chia số quá nhỏ)

## Definition of done
- File compile pass
- Chart render đúng 2 bar `%/h`
- Tooltip + legend + subtitle update
- TK idle không có bar
- File vẫn dưới 250 LOC (hiện 230)

## Status
- [x] Add `calcBurnRate7d`
- [x] Update `calcChartData`
- [x] Rename color/label helpers
- [x] Update tooltip/legend/subtitle
- [x] Update Bar 2 dataKey
- [x] Build pass (tsc --noEmit clean)
- [ ] Smoke test (manual — dev server verification by user)
