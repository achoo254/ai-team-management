# Phase 1 — Format Helper + Tests

## Overview
**Priority:** High · **Status:** completed
Pure function formatter for quota reset ISO strings → VN-localized relative+absolute labels.

## Related files
- **Create:** `packages/web/src/lib/format-reset.ts`
- **Create:** `tests/lib/format-reset.test.ts`

## API
```ts
export interface ResetFormat {
  label: string
  isOverdue: boolean
  isImminent: boolean  // <5 phút
}
export function formatResetTime(iso: string | null, now?: Date): ResetFormat
```

## Logic (4 bands)

| Input | `label` | Flags |
|---|---|---|
| `null` | `—` | — |
| Past (diff<=0) | `Đang chờ cập nhật` | `isOverdue: true` |
| `<5 phút` | `Sắp reset (HH:MM)` | `isImminent: true` |
| `5min..24h` (same day) | `Còn Xh YYmin (HH:MM)` | — |
| `<24h` (next calendar day) | `Còn Xh (HH:MM mai)` | — |
| `>24h` | `T{D} DD/MM ~HH:MM (còn X ngày)` | — |

### Date formatting
- Weekday: `["CN","T2","T3","T4","T5","T6","T7"]` (Vietnamese)
- Time: `HH:MM` (24h, padded)
- Date: `DD/MM` (padded)

### Relative helpers
- Minutes diff < 60 → "Còn Xmin"
- Hours diff < 24 → "Còn Xh" (strip minutes if 0, else "Xh YYmin")
- Days diff ≥ 1 → "còn X ngày" (round down)

## Todo
- [ ] Create `format-reset.ts` with `formatResetTime(iso, now?)` + types
- [ ] Add helper `formatClockTime(date): "HH:MM"`
- [ ] Add helper `formatDateLabel(date): "T5 07/04"`
- [ ] Add helper `formatRelative(diffMs): "2h15" | "18h" | "3 ngày"`
- [ ] JSDoc each public function with examples
- [ ] Create test file with 8 cases covering all bands

## Test cases
- [ ] null → `{ label: "—", ... }`
- [ ] 2 min future → `isImminent: true`, "Sắp reset (HH:MM)"
- [ ] 30 min future → "Còn 30min (HH:MM)"
- [ ] 2h15 future (same day) → "Còn 2h15 (HH:MM)"
- [ ] 18h future (next day) → "Còn 18h (HH:MM mai)"
- [ ] 3 ngày future → "T{day} DD/MM ~HH:MM (còn 3 ngày)"
- [ ] Past ISO → `isOverdue: true`, "Đang chờ cập nhật"
- [ ] Edge: exactly 5 min → NOT imminent (boundary)

## Success criteria
- Function pure (accepts `now?` for testability)
- File <80 LOC
- All 8 tests pass
- Typecheck clean

## Risks
- Timezone: client-side `new Date()` auto-uses browser TZ → safe
- Day boundary detection: compare `getDate()` + `getMonth()` + `getFullYear()` (not diff in ms)
