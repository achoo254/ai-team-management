# Phase 4: Frontend UI

**Priority:** Medium | **Effort:** M | **Status:** Complete

## Overview

Extend `WatchThresholdDialog` with a collapsible "Cảnh báo dự đoán" section for predictive alert settings.

## Files to Modify

1. `packages/web/src/components/watch-threshold-dialog.tsx` — Add predictive config section
2. `packages/web/src/hooks/use-watched-seats.ts` — Include new fields in mutation payloads

## Implementation Steps

### 1. Update `use-watched-seats.ts`

Extend `WatchThresholds` interface:
```typescript
interface WatchThresholds {
  threshold_5h_pct?: number
  threshold_7d_pct?: number
  burn_rate_threshold?: number | null
  eta_warning_hours?: number | null
  forecast_warning_hours?: number | null
}
```

### 2. Update `watch-threshold-dialog.tsx`

**Props** — extend `current`:
```typescript
current?: {
  threshold_5h_pct: number
  threshold_7d_pct: number
  burn_rate_threshold?: number | null
  eta_warning_hours?: number | null
  forecast_warning_hours?: number | null
}
```

**State** — add 3 new state vars:
```typescript
const [burnRate, setBurnRate] = useState<number | null>(current?.burn_rate_threshold ?? 15)
const [etaWarning, setEtaWarning] = useState<number | null>(current?.eta_warning_hours ?? 1.5)
const [forecastWarning, setForecastWarning] = useState<number | null>(current?.forecast_warning_hours ?? 48)
```

**UI** — add collapsible section below existing thresholds:

```tsx
{/* Collapsible predictive section */}
<details className="mt-3">
  <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
    Cảnh báo dự đoán (nâng cao)
  </summary>
  <div className="mt-2 space-y-3 pl-1">
    {/* Fast Burn: burn rate + ETA */}
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Checkbox checked={burnRate !== null}
          onCheckedChange={(c) => setBurnRate(c ? 15 : null)} />
        <Label className="text-xs">Cháy nhanh 5h</Label>
      </div>
      {burnRate !== null && (
        <div className="pl-6 space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Tốc độ ≥</span>
            <input type="number" min={5} max={50} step={1}
              value={burnRate} onChange={e => setBurnRate(Number(e.target.value) || 15)}
              className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs" />
            <span>%/h</span>
          </div>
          <div className="flex items-center gap-2">
            <span>VÀ còn ≤</span>
            <input type="number" min={0.5} max={4} step={0.5}
              value={etaWarning ?? 1.5}
              onChange={e => setEtaWarning(Number(e.target.value) || 1.5)}
              className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs" />
            <span>giờ</span>
          </div>
        </div>
      )}
    </div>

    {/* Quota Forecast: warning hours */}
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Checkbox checked={forecastWarning !== null}
          onCheckedChange={(c) => setForecastWarning(c ? 48 : null)} />
        <Label className="text-xs">Dự đoán chạm ngưỡng 7d</Label>
      </div>
      {forecastWarning !== null && (
        <div className="pl-6 text-xs text-muted-foreground flex items-center gap-2">
          <span>Cảnh báo trước</span>
          <input type="number" min={6} max={168} step={6}
            value={forecastWarning}
            onChange={e => setForecastWarning(Number(e.target.value) || 48)}
            className="w-14 rounded border bg-background px-1.5 py-0.5 text-xs" />
          <span>giờ</span>
        </div>
      )}
    </div>
  </div>
</details>
```

**Save handler** — include new fields:
```typescript
const body = {
  threshold_5h_pct: clamp(th5h),
  threshold_7d_pct: clamp(th7d),
  burn_rate_threshold: burnRate,
  eta_warning_hours: burnRate !== null ? etaWarning : null,
  forecast_warning_hours: forecastWarning,
}
```

### 3. Update info text

Change the help text from:
> ℹ Ngưỡng này chỉ kích hoạt cảnh báo khi usage vượt mức.

To:
> ℹ Ngưỡng kích hoạt cảnh báo khi usage vượt mức. Mở "Cảnh báo dự đoán" để cảnh báo sớm trước khi chạm ngưỡng.

## UI Mock

```
┌─────────────────────────────────┐
│ Sửa ngưỡng                   ✕ │
│ TK Đạt                         │
│                                 │
│ Ngưỡng 5 giờ (%)               │
│ ═══════════════○═══     [90]    │
│                                 │
│ Ngưỡng 7 ngày (%)              │
│ ════════════○═══════     [85]   │
│                                 │
│ ▸ Cảnh báo dự đoán (nâng cao)  │  ← collapsed by default
│ ┌·····························┐ │
│ │ ☑ Cháy nhanh 5h            │ │
│ │   Tốc độ ≥ [15] %/h        │ │
│ │   VÀ còn ≤ [1.5] giờ       │ │
│ │                             │ │
│ │ ☑ Dự đoán chạm ngưỡng 7d   │ │
│ │   Cảnh báo trước [48] giờ  │ │
│ └·····························┘ │
│                                 │
│ ℹ Ngưỡng kích hoạt cảnh báo... │
│                                 │
│              [Hủy]    [Lưu]    │
└─────────────────────────────────┘
```

## Success Criteria

- [x] Dialog shows collapsible predictive section (collapsed by default)
- [x] Checkbox toggles enable/disable (null vs value)
- [x] ETA field linked to burn rate toggle (disabled when burn rate off)
- [x] Values saved via existing mutation hooks
- [x] Editing existing watch loads saved predictive values
