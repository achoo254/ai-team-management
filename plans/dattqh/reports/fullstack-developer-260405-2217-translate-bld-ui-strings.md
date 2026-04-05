# Translation Report — BLD UI Strings → Vietnamese

**Date:** 2026-04-05  
**Status:** DONE

---

## Files Modified

| File | Changes |
|------|---------|
| `packages/web/src/components/bld-fleet-kpi-cards.tsx` | "Fleet Utilization" → "Mức sử dụng fleet" |
| `packages/web/src/components/bld-seat-stats-panel.tsx` | Card titles: "Top 5 Util %" → "Top 5 mức sử dụng", "Top 5 Waste $" → "Top 5 lãng phí", "Burndown Risk" → "Nguy cơ quá tải", "Degradation Watch W/W" → "Theo dõi suy giảm tuần"; badge label "% util" → "% sử dụng" |
| `packages/web/src/components/bld-actions-panel.tsx` | "Rebalance 2 seats" → "Cân bằng 2 seat" |
| `packages/web/src/components/bld-ww-comparison-chart.tsx` | Series name + dataKey + tooltip check: "Utilization (%)" → "Mức sử dụng (%)" (3 occurrences kept consistent) |
| `packages/web/src/components/token-failure-panel.tsx` | Column header "Retry" → "Thử lại", button text "Retry" → "Thử lại", title attr "Retry token fetch" → "Thử lại lấy token" |
| `packages/web/src/components/bld-alert-settings-form.tsx` | Card title "BLD Alert Settings" → "Cài đặt cảnh báo BLD" |
| `packages/api/src/services/bld-pdf-service.ts` | All English strings → no-diacritics Vietnamese (see below) |

## PDF Strings Translated (no-diacritics)

| English | Vietnamese (no diacritics) |
|---------|---------------------------|
| "BLD Weekly Digest" | "Bao cao tuan BLD" |
| "Generated: {ts}" | "Tao luc: {ts}" |
| "Fleet KPIs" | "Chi so tong quan" |
| "Fleet Utilization: X%" | "Su dung fleet: X%" |
| "Waste: $X/month" | "Lang phi: $X/thang" |
| "W/W Delta: X%" | "Chenh lech tuan: X%" |
| "Billable Seats: N x $X = $Y/month" | "Seat tinh phi: N x $X = $Y/thang" |
| "Top 3 Waste Seats" | "Top 3 seat lang phi nhat" |
| "No data available." | "Khong co du lieu." |
| "Waste: X% ($Y/month)" (per seat) | "Lang phi: X% ($Y/thang)" |
| "W/W Utilization Trend (8 weeks)" | "Xu huong su dung 8 tuan gan nhat" |
| "No historical data." | "Khong co du lieu lich su." |
| Column "Week Start" | "Tuan" |
| Column "Util %" | "Su dung %" |
| Column "Waste $" | "Lang phi $" |
| "+$X/month" (add_seat) | "+$X/thang" |

## Files NOT changed (already Vietnamese or no English UI strings)

- `bld-actions-panel.tsx` — mostly already Vietnamese; only "Rebalance 2 seats" fixed
- `bld-fleet-kpi-cards.tsx` — mostly already Vietnamese; only "Fleet Utilization" header fixed
- `stale-data-banner.tsx` — fully Vietnamese already
- `forecast-urgent-card.tsx` — STATUS_LABEL already correct, no English UI strings
- `bld.tsx` — fully Vietnamese already

## Build Status

- `pnpm -F @repo/web build`: PASS (tsc + vite, 0 errors)
- `npx tsc --noEmit` (api): Pre-existing errors only (rootDir/module export issues from prior work, not introduced by this task)
- `pnpm test`: 88/88 PASS

## Translation Decisions

- "Burndown Risk" → "Nguy cơ quá tải" — "burndown" means quota burning down fast; "quá tải" (overload) chosen to convey urgency in Vietnamese context
- "Degradation Watch W/W" → "Theo dõi suy giảm tuần" — dropped "W/W" from card title since the panel is clearly weekly; "suy giảm" = degradation
- "% util" badge in TopWasteCard → "% sử dụng" — more natural than "% util"
- "Cân bằng 2 seat" for "Rebalance 2 seats" — "rebalance" kept as verb concept but translated to "cân bằng" for readability; "seat" kept as technical term
- PDF: "Chi so tong quan" for "Fleet KPIs" — spec said "Chi so tong quan", adopted

## Concerns

- None critical. Pre-existing API typecheck errors unrelated to this translation task.
