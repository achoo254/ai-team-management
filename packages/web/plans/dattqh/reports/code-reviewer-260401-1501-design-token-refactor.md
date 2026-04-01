# Code Review: Design Token Refactor (Chart Colors)

**Scope:** 5 files (1 new, 4 modified) | ~30 LOC new, ~20 LOC removed
**Focus:** Correctness, edge cases, theme reactivity

## Overall Assessment

Clean, well-scoped refactor. Replaces hardcoded hex colors with CSS custom property resolution for Recharts SVG elements. Design rationale (Recharts can't resolve `var()` in fill/stroke) is sound.

## Critical Issues

None.

## High Priority

### 1. cssVar() returns empty string on missing/undefined CSS vars — silent fallback to invisible color

**File:** `packages/web/src/lib/chart-colors.ts:3`

`getComputedStyle().getPropertyValue()` returns `""` for undefined properties. In `cssVar()`, this means an empty string is passed to Recharts as `fill=""` or `stroke=""` — rendering invisible chart elements with no error.

**Impact:** If a CSS var is typo'd or removed, charts silently break (no color visible).

**Fix suggestion:**
```ts
export function cssVar(name: string, fallback?: string): string {
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!val && fallback) return fallback;
  return val;
}
```

Or at minimum, add a `console.warn` in dev mode when `val` is empty.

### 2. getTeamColor() — CSS var name mismatch between `@theme` and `getComputedStyle`

**File:** `chart-colors.ts:13` and `tailwind.css:11-12`

CSS defines `--color-team-dev` and `--color-team-mkt` inside `@theme inline`. The utility calls `cssVar("--color-team-dev")` which queries `getComputedStyle` for that exact property name.

**Tailwind v4 `@theme inline`** registers these as Tailwind design tokens (`theme(--color-team-dev)`), but whether they appear as bare CSS custom properties on `:root` depends on Tailwind's output. Standard `@theme` vars get emitted as CSS custom props, so this should work — but worth verifying in the browser DevTools that `getComputedStyle(document.documentElement).getPropertyValue('--color-team-dev')` actually returns the value.

**Risk:** Medium — if Tailwind v4 namespaces or omits these, `getTeamColor()` silently falls back to chart palette for ALL teams, masking the bug.

### 3. Theme toggle does not re-render charts with new colors

**File:** All chart components

`cssVar()` is called at render time inside JSX. When the user toggles dark/light mode by toggling `.dark` class on `<html>`, the chart components do NOT re-render because:
- No React state change triggers re-render
- `cssVar()` is a side-effect read, not reactive

The colors will remain from the previous theme until something else causes a re-render (navigation, data refetch, etc.).

**Fix suggestion:** Either:
- (a) Pass theme as a dependency in the React Query hook or context so toggling theme triggers re-render, or
- (b) Use a `useSyncExternalStore` or `useEffect` + `MutationObserver` on `<html>` class changes to force re-render, or
- (c) Accept this as known limitation and document it (simplest if theme toggle is rare during active chart viewing)

## Medium Priority

### 4. Only 2 of N teams have dedicated CSS colors

Only `dev` and `mkt` have `--color-team-*` vars. Any other team falls through to `getChartColors()[index % 5]`. This is fine as a fallback, but if teams are added later, they get chart-palette colors that may clash with existing series. Consider documenting that new teams should add a `--color-team-{key}` entry.

### 5. getChartColors() called repeatedly in getTeamColor()

Each `getTeamColor()` call triggers `getChartColors()` which calls `cssVar()` 5 times (5x `getComputedStyle` reads). In `team-pie-chart.tsx`, this runs per `Cell` in the `.map()`. For N teams, that's up to N*5 `getComputedStyle` calls just for fallback.

**Impact:** Low for current scale (few teams). Not a real perf issue, but could memoize:
```ts
let _cache: string[] | null = null;
export function getChartColors(): string[] {
  if (_cache) return _cache;
  _cache = [1, 2, 3, 4, 5].map((i) => cssVar(`--chart-${i}`));
  return _cache;
}
```
Note: module-level cache would need invalidation on theme change. Skip this unless perf profiling shows need.

## Low Priority

### 6. color-scheme addition is correct
`color-scheme: light` on `html` and `color-scheme: dark` on `html.dark` — proper browser hint for scrollbars, form controls, etc. No issues.

## Positive Observations

- Clean separation: utility in `lib/`, consumers import only what they need
- No SSR concern acknowledged — correct for Vite SPA
- Intentional exclusion of team-form-dialog and login colors from refactor is the right call (those are user-facing picker values and brand colors)
- Old `TEAM_COLORS`/`FALLBACK_COLORS` fully removed, no dangling references
- Chart-1..5 vars defined in both light and dark themes

## Recommended Actions

1. **[High]** Verify `--color-team-*` vars resolve via `getComputedStyle` in browser (Tailwind v4 `@theme` output)
2. **[High]** Add fallback or warning to `cssVar()` for empty returns
3. **[Medium]** Decide on theme-toggle reactivity: accept limitation or add observer
4. **[Low]** Document that new teams need `--color-team-{key}` CSS var entry

## Unresolved Questions

- Has the `--color-team-*` resolution been verified in browser DevTools with the actual Tailwind v4 build output?
- Is there an existing mechanism that triggers chart re-render on theme toggle (e.g., QueryClient invalidation)?
