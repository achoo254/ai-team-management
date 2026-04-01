---
phase: 3
status: skipped
priority: low
effort: 30m
rationale: Tailwind defaults sufficient for current scale; elevation tokens add unnecessary complexity
---

# Phase 3 — Token Expansion (Optional)

## Context

MCP design-system provides elevation tokens not currently used. Tailwind defaults cover spacing/typography. This phase adds only tokens with clear use-cases.

## MCP Reference Tokens

From `mcp__design-system__search_tokens("elevation")`:

| Token | Value |
|-------|-------|
| `elevation.sm` | `0px 1px 2px rgba(0, 0, 0, 0.05)` |
| `elevation.base` | `0px 1px 3px rgba(0, 0, 0, 0.1), 0px 1px 2px rgba(0, 0, 0, 0.06)` |
| `elevation.md` | `0px 4px 6px rgba(0, 0, 0, 0.1), 0px 2px 4px rgba(0, 0, 0, 0.06)` |
| `elevation.lg` | `0px 10px 15px rgba(0, 0, 0, 0.1), 0px 4px 6px rgba(0, 0, 0, 0.05)` |
| `elevation.dark.sm` | `0px 1px 2px rgba(0, 0, 0, 0.2)` |
| `elevation.dark.md` | `0px 4px 8px rgba(0, 0, 0, 0.3)` |

## Implementation (IF NEEDED)

### Add elevation tokens to `tailwind.css`

Only if cards/components need custom shadows beyond Tailwind's `shadow-sm/md/lg`:

```css
@theme inline {
  /* ... existing ... */

  /* Elevation — from MCP design-system */
  --shadow-elevation-1: 0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px rgba(0,0,0,0.06);
  --shadow-elevation-2: 0px 4px 6px rgba(0,0,0,0.1), 0px 2px 4px rgba(0,0,0,0.06);
  --shadow-elevation-3: 0px 10px 15px rgba(0,0,0,0.1), 0px 4px 6px rgba(0,0,0,0.05);
}
```

### Add dark mode elevation overrides

```css
.dark {
  /* ... existing ... */
  /* Darker shadows for dark mode */
}
```

## Decision

**SKIP unless:** specific UI component needs elevation beyond `shadow-sm`/`shadow-md`/`shadow-lg`. Current Tailwind defaults are fine for dashboard cards.

## Success Criteria

- [ ] Tokens added only if consumed by at least one component
- [ ] Dark mode shadow variants if applicable
