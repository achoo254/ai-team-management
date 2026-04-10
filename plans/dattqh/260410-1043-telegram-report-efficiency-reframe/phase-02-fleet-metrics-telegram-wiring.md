# Phase 02 — Wire Fleet Metrics + Rewrite Telegram Overview

## Context Links

- Plan overview: `./plan.md`
- Previous phase: `./phase-01-forecast-efficiency-bucketing.md`
- Target files:
  - `packages/api/src/services/bld-metrics-service.ts`
  - `packages/api/src/services/telegram-service.ts`
  - `packages/shared/types.ts`

## Overview

- **Priority:** High
- **Status:** pending
- **Effort:** M (~2–3h)
- **Depends on:** Phase 01 complete

Wire `FleetEfficiency` từ Phase 01 vào `FleetKpis`, rewrite Telegram overview section để hiển thị 3-bucket, bỏ cảnh báo imperative cũ.

## Key Insights

- `FleetKpis.worstForecast` vẫn giữ (có thể dùng cho dashboard web), nhưng Telegram sẽ KHÔNG dùng nữa
- Wording mới phải tuyệt đối: **zero imperative + zero `!`**
- Section "⚠️ X seat(s) > 80% — cần giảm tải!" (L131–133) → **xoá hẳn**, insight đã chuyển sang efficiency section
- Alert cá nhân L376 **KHÔNG động**

## Requirements

### Functional
- Extend `FleetKpis` type với `efficiency: FleetEfficiency | null`
- `bld-metrics-service.ts` compute efficiency và gắn vào KPI output
- `telegram-service.ts::buildOverviewSection()` rewrite hoàn toàn để hiển thị 3-bucket
- Xoá block cảnh báo L131–133 trong `buildReportHtml()`
- Export `FleetEfficiency` type qua `packages/shared/types.ts` nếu web cũng cần dùng (optional, defer nếu chưa cần)

### Non-functional
- `buildOverviewSection` vẫn <30 LOC (nếu vượt tách helper)
- Telegram HTML format giữ nguyên escape rules (dùng `esc()`)
- Backward compat: nếu `efficiency = null` (chưa compute được) fallback về format cũ đơn giản (không crash)

## Wording Spec (Telegram Overview Mới)

```
📊 Báo cáo Usage — 10/4/2026

── TỔNG QUAN ──────────────
📈 Tận dụng TB 7 ngày: 68% (so tuần trước: +4.2%)
💸 Lãng phí ước tính: $84/$1200/tháng
💺 Tổng: 12 seats

── HIỆU QUẢ SỬ DỤNG ────────
✅ Tối ưu:     8 seats  (dự kiến đạt ≥85% khi reset)
🔴 Quá tải:    1 seat   — Seat_A (cạn sớm ~1.8 ngày trước reset)
🟡 Lãng phí:   3 seats  — ~$28/chu kỳ không tận dụng
⏸ Chưa đủ dữ liệu: 0 seats

── CHI TIẾT SEATS ──────────
...
```

**Rules:**
- Dùng `✅`/`🔴`/`🟡`/`⏸` thay cho `⚠️`
- Bỏ hẳn dòng "sắp cạn quota" + "nên cân nhắc đổi tài khoản khác"
- Overload: chỉ hiển thị tên seat + số giờ sớm hơn reset. Không có action verb.
- Waste: aggregate $ lãng phí/chu kỳ (tổng), không liệt kê từng seat (tránh noise)
- Unknown: chỉ show nếu count > 0

### Handling edge cases
- Nếu tất cả seats `unknown` → show: `⏸ Đang thu thập dữ liệu (N seats)`, skip 3-bucket
- Nếu `efficiency = null` → skip section "HIỆU QUẢ SỬ DỤNG"

## Related Code Files

**Modify:**
- `packages/api/src/services/bld-metrics-service.ts` — extend FleetKpis + compute efficiency
- `packages/api/src/services/telegram-service.ts`:
  - `buildOverviewSection()` — L55–71 rewrite
  - `buildReportHtml()` — xoá L131–133
- `packages/shared/types.ts` — thêm `FleetEfficiency` nếu cần cross-package

**Read for context:**
- `packages/api/src/routes/bld-metrics.ts` — xem output schema hiện tại có break không
- `packages/web/src/components/bld-fleet-kpi-cards.tsx` — check web có đọc `worstForecast` không để đảm bảo backward compat

## Implementation Steps

1. **Extend FleetKpis type**
   - Mở `bld-metrics-service.ts`, tìm `FleetKpis` interface
   - Thêm field `efficiency: FleetEfficiency | null`
   - Import `FleetEfficiency` từ `quota-forecast-service.ts`
   - Note: cost = flat `SEAT_MONTHLY_COST_USD = 125` (Phase 01), không cần subscription type lookup
2. **Compute efficiency trong `bld-metrics-service`**
   - Trong function build KPI, sau khi có `seatIds`, gọi `computeFleetEfficiency(seatIds)`
   - Gắn vào object return
3. **Rewrite `buildOverviewSection()` trong `telegram-service.ts`**
   - Giữ 3 dòng đầu (Tận dụng TB, Lãng phí, Tổng seats)
   - Xoá L65–69 (worst forecast warning)
   - Thêm function helper `buildEfficiencySection(efficiency: FleetEfficiency): string`
   - Gọi helper nếu `kpis.efficiency` không null
4. **Xoá L131–133 trong `buildReportHtml()`**
   - Block `if (high.length > 0) { msg += '⚠️ ... cần giảm tải!' }`
5. **Verify web không break**
   - Grep `worstForecast` trong packages/web → nếu có reference, giữ field trong FleetKpis (chỉ bỏ khỏi Telegram)
6. **Build check**
   - `pnpm -F @repo/api build`
   - `pnpm -F @repo/web build` (nếu shared types đổi)

## Pseudocode for buildEfficiencySection

```typescript
function buildEfficiencySection(eff: FleetEfficiency): string {
  if (eff.total_seats === 0) return ''

  // Tất cả unknown → hiển thị thông báo thu thập
  if (eff.unknown_count === eff.total_seats) {
    return `── <b>HIỆU QUẢ SỬ DỤNG</b> ────\n⏸ Đang thu thập dữ liệu (${eff.total_seats} seats)\n`
  }

  let msg = `── <b>HIỆU QUẢ SỬ DỤNG</b> ────\n`
  msg += `✅ Tối ưu:     ${eff.optimal_count} seats\n`

  if (eff.overload.length > 0) {
    const names = eff.overload
      .slice(0, 3)
      .map(o => `${esc(o.seat_label)} (cạn sớm ~${o.hours_early.toFixed(1)}h)`)
      .join(', ')
    const more = eff.overload.length > 3 ? ` +${eff.overload.length - 3}` : ''
    msg += `🔴 Quá tải:    ${eff.overload.length} seat(s) — ${names}${more}\n`
  } else {
    msg += `🔴 Quá tải:    0 seats\n`
  }

  if (eff.waste.seats.length > 0) {
    msg += `🟡 Lãng phí:   ${eff.waste.seats.length} seats — ~$${Math.round(eff.waste.total_waste_usd)}/chu kỳ không tận dụng\n`
  } else {
    msg += `🟡 Lãng phí:   0 seats\n`
  }

  if (eff.unknown_count > 0) {
    msg += `⏸ Chưa đủ dữ liệu: ${eff.unknown_count} seats\n`
  }

  return msg
}
```

## Todo List

- [ ] Extend `FleetKpis` type với `efficiency` field
- [ ] Wire `computeFleetEfficiency()` vào `bld-metrics-service`
- [ ] Implement `buildEfficiencySection()` helper
- [ ] Rewrite `buildOverviewSection()` — xoá worst forecast warning
- [ ] Xoá block cảnh báo L131–133 trong `buildReportHtml()`
- [ ] Verify `packages/web` không break (grep `worstForecast`)
- [ ] Build pass: api + web + shared

## Success Criteria

- Telegram overview mới hiển thị đúng 3-bucket format
- Zero imperative + zero `!` trong overview (grep check: `cần|nên cân nhắc|!`)
- Existing web dashboard không broken
- Build pass all packages

## Risks

- **Web có thể đang dùng `worstForecast`** — giữ field trong `FleetKpis` nếu có, chỉ thay đổi cách Telegram render
- **Double-compute performance** — `computeFleetEfficiency` gọi `computeAllSeatForecasts` mà có thể đã được gọi ở nơi khác trong `bld-metrics-service`. Cần check để không duplicate query. Mitigation: refactor để forecast được compute 1 lần và reuse
- **Guard 24h** — seat vừa reset sẽ show `unknown` trong 24h đầu chu kỳ mới → acceptable, wording đã handle ("Chưa đủ dữ liệu")

## Security Considerations

- HTML escape: tất cả string từ DB phải qua `esc()` trước khi chèn vào template (đã có sẵn helper, reuse)

## Next Steps

→ Phase 03: tests + manual verification với real data
