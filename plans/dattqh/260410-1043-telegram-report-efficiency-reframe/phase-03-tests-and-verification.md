# Phase 03 — Tests + Verification

## Context Links

- Plan overview: `./plan.md`
- Phase 01: `./phase-01-forecast-efficiency-bucketing.md`
- Phase 02: `./phase-02-fleet-metrics-telegram-wiring.md`

## Overview

- **Priority:** High
- **Status:** pending
- **Effort:** S (~1h)
- **Depends on:** Phase 01 + 02 complete

Unit tests cho classification logic, integration test cho telegram output, manual verify bằng dry-run với real DB data.

## Requirements

### Functional
- Unit tests `classifyEfficiency()`: cover 4 bucket cases + edge cases
- Unit tests `getSeatMonthlyCost()`: cover known/unknown/null subscription types
- Integration test `buildEfficiencySection()`: verify HTML output format + escape
- Manual dry-run: chạy `sendUsageReport` trên staging/local, verify output trong Telegram (dùng test chat)

### Non-functional
- Test file size <200 LOC mỗi file
- Reuse `tests/helpers/db-helper.ts` cho in-memory Mongo
- Test names descriptive (LLM-friendly)

## Test Cases

### `classifyEfficiency()` — unit (unified projected_pct axis)

| Case | Input | Expected bucket |
|---|---|---|
| Collecting status | `status: 'collecting'` | `unknown` |
| No resets_at | `resets_at: null` | `unknown` |
| Reset time đã qua | `hoursToReset <= 0` | `unknown` |
| Đầu chu kỳ (<24h) | `hoursSinceReset = 12` | `unknown` |
| Projected = 100% (sẽ cạn) | slope → projected = 100 | `overload`, `hours_early > 0` |
| Projected = 92% | slope → projected = 92 | `optimal` |
| Projected = 85% (biên) | slope → projected = 85 | `optimal` |
| Projected = 84% (biên) | slope → projected = 84 | `waste`, `waste_pct: 1` |
| Projected = 60% | slope → projected = 60 | `waste`, `waste_pct: 25` |
| Slope = 0, current = 40% | stale seat | `waste`, `waste_pct: 45` |

### `buildEfficiencySection()` — unit/snapshot

| Case | Assertion |
|---|---|
| All buckets có seats | Contains `✅ Tối ưu`, `🔴 Quá tải`, `🟡 Lãng phí` |
| Tất cả unknown | Contains `⏸ Đang thu thập dữ liệu`, không có 3 bucket chính |
| Efficiency null | Returns empty string |
| No waste | Dòng 🟡 vẫn hiển thị với count 0 |
| Overload > 3 seats | Hiển thị 3 seats đầu + `+N` |
| HTML escape | Seat label `<script>` phải bị escape |

### Integration test (1 end-to-end)

| Case | Description |
|---|---|
| 3-seat fixture | In-memory Mongo: 1 optimal (projected 90%), 1 overload (projected 100%), 1 waste (projected 60%). Pipe qua `computeFleetEfficiency()` → `buildEfficiencySection()` → assert output contains đúng 3 bucket lines + waste USD |

### Regression check — manual

- Grep toàn repo sau change: `cần giảm tải|nên cân nhắc đổi tài khoản` → expect 0 matches
- Grep Telegram output: `!` trong overview section → expect 0 matches (trừ text cố định của markdown format)
- `alert-service.ts` L376 không thay đổi → git diff check

## Related Code Files

**Create:**
- `tests/services/quota-efficiency.test.ts` — unit tests classification + fleet efficiency
- `tests/services/telegram-efficiency-section.test.ts` — snapshot test section builder

**Read for context:**
- `tests/helpers/db-helper.ts`
- `tests/setup.ts`
- Existing `tests/api/` for style reference

## Implementation Steps

1. Create `tests/services/quota-efficiency.test.ts`
   - Mock `SeatForecast` objects directly (pure function, no DB)
   - 1 describe block per function
2. Create `tests/services/telegram-efficiency-section.test.ts`
   - Mock `FleetEfficiency` input
   - Assert string contains expected tokens
3. Run `pnpm test` → expect all pass
4. Manual verify:
   - Local/staging env
   - Trigger `sendUsageReport()` via dev script or cron manual trigger
   - Check Telegram test chat nhận đúng format
5. Compare git diff with expected: `alert-service.ts` không đổi, telegram overview rewrote

## Todo List

- [ ] Write `quota-efficiency.test.ts` (classification + cost map)
- [ ] Write `telegram-efficiency-section.test.ts` (snapshot tests)
- [ ] `pnpm test` — all pass
- [ ] Regression grep — 0 forbidden phrases
- [ ] Manual Telegram dry-run — output đúng format
- [ ] Git diff review: `alert-service.ts` unchanged

## Success Criteria

- All new tests pass
- Existing tests still pass (0 regression)
- Manual Telegram output matches wording spec từ Phase 02
- Zero imperative/exclamation in overview section (verified by grep)
- Build clean: `pnpm -F @repo/api build` + `pnpm lint`

## Risks

- **Snapshot tests brittle** khi wording thay đổi — dùng substring assertion (`expect(out).toContain('✅ Tối ưu')`) thay vì full snapshot
- **Manual dry-run cần real data** — nếu local DB trống, seed vài seats với usage snapshots giả để test

## Next Steps

- Merge → deploy staging → observe 1 chu kỳ (7 ngày) → tune ngưỡng nếu cần
- Update `docs/project-changelog.md` với entry "Telegram efficiency reframe"
- Note cho bản tune tiếp theo: track `waste_pct` thực tế vs predicted để calibrate threshold
