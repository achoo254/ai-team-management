# Brainstorm — Dashboard Reset Time Display

**Date:** 2026-04-05
**Scope:** Display quota reset times (5h + 7d) across dashboard surfaces
**Status:** Approved → ready for `/ck:plan`

## Problem

Dashboard hiện tại không hiển thị thời gian reset cho quota 5h/7d. User không biết khi nào quota refresh → khó plan usage. Data đã có sẵn trong DB (`usage_snapshots.five_hour_resets_at`, `seven_day_resets_at`) và đã trả về qua `/api/dashboard/enhanced`. **Pure UI gap.**

## Current state (scout)

| Surface | Usage bar? | Reset shown? |
|---|---|---|
| `usage-snapshot-card.tsx` | ✅ | ✅ (đã làm) |
| `alert-card.tsx` | — | ✅ metadata |
| `seat-card.tsx` | ❌ management card | N/A |
| `dashboard-stat-overview.tsx` | ✅ aggregate | ❌ |
| `dashboard-detail-table.tsx` | ✅ table cols | ❌ |
| `dashboard-seat-usage-chart.tsx` | ✅ tooltip | ❌ |
| `dashboard-efficiency.tsx` + `quota-forecast-bar.tsx` | ✅ team quota | ❌ |

## Approach — shared helper + 4 spot fixes

### New helper
`packages/web/src/lib/format-reset.ts`:
```ts
formatResetTime(iso: string | null): {
  label: string
  isOverdue: boolean
  isImminent: boolean
}
```

**Thresholds:**
- `null` → `—`
- Past → `Đang chờ cập nhật`
- `<5 phút` → `Sắp reset (18:00)`
- `5min - 24h` → `Còn 2h15 (18:00)` | `Còn 18h (09:00 mai)`
- `>24h` → `T2 09/04 ~09:00 (còn 3 ngày)`

### Apply points

1. **QuotaForecastBar** — thêm line `↻ Reset định kỳ: ...` dưới forecast line
2. **dashboard-detail-table** — tooltip trên `pctCell` (không thêm cột mới, giữ mobile layout)
3. **dashboard-seat-usage-chart** — extend TooltipRow thêm 1 dòng reset
4. **dashboard-stat-overview** — "Seat reset sớm nhất: HH:MM" dưới stat card TB 5h/7d

### API extension

`quota_forecast.seven_day` + `five_hour` thêm field `resets_at: string | null` (lấy từ snapshot của seat tương ứng trong forecast service).

## Decisions (answered unresolved questions)

| Question | Answer | Rationale |
|---|---|---|
| Badge "Stale" khi >10min? | **KHÔNG** | Duplicate với `last_fetch_error`. KISS. |
| Cột mới vs tooltip? | **Tooltip** | 7 cột vỡ mobile. Reset = secondary info. |
| Relative vs absolute? | **3 bands combined** | <5min / 5min-24h / >24h format khác nhau |
| Live tick mỗi phút? | **KHÔNG** | `refetchInterval: 60_000` đã refresh data |

## Changes summary

| File | Action | LOC Δ |
|---|---|---|
| `packages/web/src/lib/format-reset.ts` | Create | ~40 |
| `packages/web/src/components/quota-forecast-bar.tsx` | Edit | +6 |
| `packages/web/src/components/dashboard-detail-table.tsx` | Edit | +15 |
| `packages/web/src/components/dashboard-seat-usage-chart.tsx` | Edit | +8 |
| `packages/web/src/components/dashboard-stat-overview.tsx` | Edit | +10 |
| `packages/api/src/services/quota-forecast-service.ts` | Edit | +5 |
| `packages/api/src/routes/dashboard.ts` | Edit | +5 |
| `packages/shared/types.ts` | Edit | +2 |
| `tests/lib/format-reset.test.ts` | Create | ~50 |

## Phases (3)

1. **Format helper + tests** — pure function
2. **API extension** — `resets_at` in QuotaForecast + types
3. **UI wiring** — 4 components consume helper

## Success criteria

- Reset time visible ở 4 surfaces
- Format identical across surfaces
- Null/past/imminent edge cases handle đúng
- Helper tests pass
- Files <200 LOC each
- `pnpm test` pass

## Risks

- API extension cần sync types trước frontend → Phase 2 xong trước Phase 3
- `Math.min` trên Date strings → convert sang `getTime()` ms

## Unresolved questions
_None — all answered above._
