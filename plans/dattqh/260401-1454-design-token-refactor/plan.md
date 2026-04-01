---
status: complete
priority: medium
effort: 2h
blockedBy: []
blocks: []
---

# Design Token Refactor Plan

**Report:** `../reports/design-system-audit-260401-1451-style-validation.md`
**Scope:** Replace hardcoded colors in chart components, clean up theme system, expand token coverage

## Phases

| # | Phase | Effort | Status |
|---|-------|--------|--------|
| 1 | [Chart color tokenization](phase-01-chart-color-tokenization.md) | 45m | complete |
| 2 | [Theme system cleanup](phase-02-theme-system-cleanup.md) | 30m | complete |
| 3 | [Token expansion (optional)](phase-03-token-expansion.md) | 30m | skipped |

## Key Decisions

- **Recharts + CSS vars:** Recharts SVG elements don't resolve `var()` in `fill`/`stroke` props. Need `getComputedStyle()` helper.
- **Team color picker:** `team-form-dialog.tsx` COLORS array kept as-is — user-selectable palette, not theme-bound.
- **Login Google colors:** Kept as-is — brand identity colors.
- **MCP alignment:** Deferred — project uses company-branded palette intentionally different from MCP tokens.
- **Typography/spacing tokens:** Skip — Tailwind defaults sufficient for current scale.

## Files Modified

```
packages/web/src/lib/chart-colors.ts        (NEW — CSS var resolver helper)
packages/web/src/components/trend-line-chart.tsx
packages/web/src/components/usage-bar-chart.tsx
packages/web/src/components/team-pie-chart.tsx
packages/web/src/lib/theme.ts
packages/web/src/tailwind.css                (optional — token expansion)
```
