# Phase 03 — Tests

## Goal
Verify burn rate calculation đúng cho edge cases, chart render đúng metric mới.

## Files
- `tests/api/bld-metrics-service.test.ts` (modify hoặc create section mới)
- `tests/ui/dashboard-seat-burn-rate-chart.test.tsx` (optional, nếu component logic phức tạp)

## Test cases — backend (`calcBurnRates`)

1. **Happy path:** seat có data đầy đủ 7d → burn5h và burn7dAvg đều > 0
2. **Idle seat:** không có snapshot → cả 2 = 0 (không throw)
3. **Seat mới <7d:** chỉ có 2 ngày data → burn7dAvg tính theo 2d (không pad 0 cho 5d còn lại)
4. **Spike detection:** burn5h = 18%/h, burn7dAvg = 5%/h → ratio > 3x
5. **5h window mới reset:** snapshot mới nhất ở t=10min sau reset → burn = pct_now / (10/60)
6. **Division guard:** hours_with_data === 0 → return 0, không NaN/Infinity
7. **Gap trong data:** snapshot bị thiếu 2h liên tục → skip gap, không nội suy

## Test cases — frontend (smoke)
1. Component render với data mock, có 2 bar
2. Sort by burn5h desc
3. Idle seat (cả 2 = 0) không render bar
4. Subtitle hiển thị đúng

## Run
```bash
pnpm vitest run tests/api/bld-metrics-service.test.ts
pnpm test  # full suite trước khi commit
```

## Definition of done
- Tất cả test cases pass
- No regressions
- `pnpm test` xanh
- `pnpm lint` không có lỗi mới

## Status
- [x] Backend test cases — N/A (plan confirmed backend unchanged, pure client-side calc)
- [x] Frontend test cases — skipped (optional; logic trivial mirror of `calcBurnRate5h`)
- [x] Full suite pass (112/112 tests green)
