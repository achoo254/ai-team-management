---
phase: 1
status: complete
priority: high
effort: 45m
---

# Phase 1 — Chart Color Tokenization

## Context

- Report: `../reports/design-system-audit-260401-1451-style-validation.md` §2 P1, P4
- 3 chart components use hardcoded hex colors instead of `--chart-*` CSS vars
- `team-pie-chart.tsx` has `TEAM_COLORS` map duplicating `--color-team-*` tokens in `tailwind.css`

## Problem

Recharts renders SVG — `fill="#14b8a6"` works but `fill="var(--chart-1)"` does NOT because SVG `fill` attribute doesn't resolve CSS custom properties. Need runtime resolution via `getComputedStyle()`.

## Implementation Steps

### Step 1 — Create chart color resolver utility

**File:** `packages/web/src/lib/chart-colors.ts` (NEW, ~15 lines)

```ts
/** Resolve CSS custom property to computed value */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Pre-resolved chart palette from --chart-1..5 CSS vars */
export function getChartColors(): string[] {
  return [1, 2, 3, 4, 5].map((i) => cssVar(`--chart-${i}`));
}

/** Resolve team color from --color-team-{key} or fallback to chart palette */
export function getTeamColor(teamKey: string, index: number): string {
  const team = cssVar(`--color-team-${teamKey}`);
  return team || getChartColors()[index % 5];
}
```

### Step 2 — Refactor `trend-line-chart.tsx`

Replace:
```tsx
stroke="#14b8a6"  →  stroke={cssVar("--chart-1")}
stroke="#3b82f6"  →  stroke={cssVar("--chart-2")}
```

Import `cssVar` from `@/lib/chart-colors`.

### Step 3 — Refactor `usage-bar-chart.tsx`

Replace:
```tsx
fill="#14b8a6"  →  fill={cssVar("--chart-1")}
fill="#3b82f6"  →  fill={cssVar("--chart-2")}
```

### Step 4 — Refactor `team-pie-chart.tsx`

- Remove `TEAM_COLORS` constant and `FALLBACK_COLORS` constant
- Import `getTeamColor` from `@/lib/chart-colors`
- Replace Cell fill logic:

```tsx
// Before
fill={TEAM_COLORS[entry.key] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]}
// After
fill={getTeamColor(entry.key, index)}
```

### Step 5 — Update `tailwind.css` chart token mapping

Verify `--chart-1` and `--chart-2` align with intended chart colors:
- Light: `--chart-1: #024799` (primary blue), `--chart-2: #0E9F6E` (success green)
- Dark: `--chart-1: #619ee9`, `--chart-2: #34D399`

Consider adding team-specific dark mode variants:
```css
/* Already exists in @theme inline */
--color-team-dev: #3b82f6;
--color-team-mkt: #22c55e;
```

These are static (not mode-aware). If dark mode variants needed, move to `:root`/`.dark` blocks.

## Success Criteria

- [x] No hardcoded hex colors in chart components (except `login.tsx` Google colors, `team-form-dialog.tsx` picker)
- [x] Charts render correctly in both light and dark mode
- [x] `TEAM_COLORS` and `FALLBACK_COLORS` constants removed from `team-pie-chart.tsx`
- [x] Colors change when CSS vars are modified (theme consistency)

## Risk

- **Recharts re-render:** `getComputedStyle()` called at render time. Acceptable perf — called once per chart render, not per tick.
- **SSR:** Not applicable — Vite SPA, `document` always available.
