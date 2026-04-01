# Design System Audit — Style Validation & Refactor Proposal

**Date:** 2026-04-01  
**Tool:** MCP design-system  
**Scope:** `packages/web` styles, tokens, theme structure

---

## 1. Current State Summary

### Theme Architecture
- **Tailwind CSS v4** with `@theme inline` block in `tailwind.css`
- **shadcn/ui** semantic token pattern: CSS vars (`--background`, `--primary`, etc.) mapped to `--color-*` Tailwind tokens
- **Light/dark mode** via `.dark` class toggle (manual, localStorage-based)
- **49 files** using `className=` (382 total usages)

### Token Categories Defined
| Category | Count | Status |
|----------|-------|--------|
| Base semantic (shadcn) | 17 vars | OK — standard pattern |
| Status tokens (success/warning/info/error) | 12 vars (3 each) | OK — surface + text + base |
| Chart palette | 5 vars | OK |
| Sidebar | 8 vars | OK |
| Radius scale | 7 vars | OK — calculated from `--radius` base |
| Team colors | 2 vars (hardcoded) | ISSUE |
| Typography | 2 vars (font-sans, font-heading) | MINIMAL |

### MCP Design System Token Comparison
| MCP Token | Value | Project Uses | Gap |
|-----------|-------|-------------|-----|
| `colors.brand.primary` | `#0582D4` | `--primary: #024799` | Different brand primary |
| `colors.brand.accent` | `#E8353C` | `--destructive: #B91C1C` | Different red |
| `colors.semantic.success` | `#1EE5B8` | `--success: #0E9F6E` | Different green |
| `colors.semantic.warning` | `#FFB74D` | `--warning: #D47B0A` | Different amber |
| `colors.semantic.error` | `#B91C1C` | `--error: #B91C1C` | MATCH |
| `colors.surface.background` | `#121212` | `--background: #0D1117` | Different dark bg |
| `shape.borderRadius.base` | `8px` | `--radius: 0.625rem (10px)` | Slightly different |

**Observation:** Project has its own color palette (company-branded, GitHub-inspired dark theme). MCP tokens represent a different design language. Alignment optional unless migrating to shared design system.

---

## 2. Issues Found

### P1 — Hardcoded Colors in Components (15 instances)

| File | Hardcoded Values | Should Use |
|------|-----------------|------------|
| `team-form-dialog.tsx` | `#6366f1, #f59e0b, #10b981, #ef4444, #3b82f6, #8b5cf6, #ec4899` | Team color tokens or `--chart-*` |
| `team-pie-chart.tsx` | `#3b82f6, #22c55e` + `FALLBACK_COLORS` array | `--color-team-dev`, `--color-team-mkt`, `--chart-*` |
| `trend-line-chart.tsx` | `#14b8a6, #3b82f6` | `--chart-1`, `--chart-2` |
| `usage-bar-chart.tsx` | `#14b8a6, #3b82f6` | `--chart-1`, `--chart-2` |
| `login.tsx` | `#FFC107, #FF3D00, #4CAF50, #1976D2` | Google brand colors — OK to keep |

**Impact:** Colors won't adapt to dark/light mode. Theme changes require touching multiple files.

### P2 — Missing Token Layers

- **No spacing tokens** — relies entirely on Tailwind defaults (`p-4`, `gap-2`, etc.)
- **No typography scale** — only `--font-sans` and `--font-heading` defined, no size/weight/line-height tokens
- **No shadow tokens** — despite MCP system having elevation tokens (`--shadow-elevation-*`)
- **No transition/animation tokens**

### P3 — Theme Toggle Implementation
- `theme.ts` is minimal (6 lines) — only toggles `.dark` class
- No system preference listener (only reads on init, doesn't react to OS changes)
- `theme-toggle.tsx` exists but untracked (new file)

### P4 — Chart Colors Inconsistency
- `tailwind.css` defines `--chart-1` through `--chart-5`
- Recharts components ignore these tokens and use hardcoded hex values
- `team-pie-chart.tsx` has its own `TEAM_COLORS` map duplicating `--color-team-*`

---

## 3. Refactor Proposal

### Phase 1 — Eliminate Hardcoded Colors (LOW effort, HIGH impact)

**Goal:** All component colors reference CSS vars or Tailwind tokens.

1. **Charts** — Replace hex strings with `var(--chart-N)` via `getComputedStyle()` or CSS-in-JS:
   ```tsx
   // Before
   <Bar fill="#14b8a6" />
   // After
   <Bar fill="var(--chart-1)" />
   ```
   Files: `trend-line-chart.tsx`, `usage-bar-chart.tsx`, `team-pie-chart.tsx`

2. **Team colors** — Add per-team CSS vars dynamically from DB `team.color`, fallback to `--color-team-*`:
   ```css
   --color-team-dev: #3b82f6;  /* already exists */
   --color-team-mkt: #22c55e;  /* already exists */
   ```
   Remove hardcoded `TEAM_COLORS` map in `team-pie-chart.tsx`.

3. **Color picker** — `team-form-dialog.tsx` COLORS array is acceptable (user-selectable), but consider generating from chart tokens.

### Phase 2 — Add Missing Token Layers (MEDIUM effort)

Add to `@theme inline` block:

```css
/* Typography scale */
--font-size-xs: 0.75rem;
--font-size-sm: 0.875rem;
--font-size-base: 1rem;
--font-size-lg: 1.125rem;
--font-size-xl: 1.25rem;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;

/* Shadow elevation */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.07);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
```

**Skip if:** Tailwind defaults are sufficient and team has no custom requirements.

### Phase 3 — Improve Theme System (LOW effort)

1. Add OS preference change listener in `theme.ts`
2. Extract theme constants into shared config
3. Consider CSS `color-scheme` property for native form elements

### Phase 4 — MCP Design System Alignment (OPTIONAL)

Only if migrating to shared design system across projects:
- Map MCP `colors.brand.*` → project `--primary`, `--accent`
- Adopt MCP `shape.borderRadius.*` scale
- Import `minimalist-2` theme (88 CSS properties) as reference

---

## 4. Priority Matrix

| Action | Effort | Impact | Priority |
|--------|--------|--------|----------|
| Replace hardcoded chart colors | 1h | High — theme consistency | P1 |
| Remove `TEAM_COLORS` duplication | 30m | Medium — DRY | P1 |
| Add OS preference listener | 15m | Low — UX polish | P3 |
| Add typography tokens | 1h | Low — Tailwind handles it | P2 (skip?) |
| Add shadow tokens | 30m | Low — Tailwind handles it | P2 (skip?) |
| MCP design system alignment | 4h+ | Depends on strategy | P4 (defer) |

---

## 5. Validation Results (MCP)

All hardcoded colors are **valid CSS color values** per MCP `validate_token`:
- `#3b82f6` — Valid
- `#14b8a6` — Valid
- `#6366f1` — Valid
- `#22c55e` — Valid
- `#ef4444` — Valid

**6 available themes** in MCP: bento-grid, glassmorphism, material, minimalist, minimalist-2 (88 props), neo-brutalism (config-enabled).

`minimalist-2` is the most comprehensive theme with shadow elevation system, glass effects, and full token coverage — could serve as reference for future expansion.

---

## Unresolved Questions

1. **Should project align with MCP design system tokens?** Current colors are company-branded and intentionally different. Need product decision.
2. **Team colors from DB** — Teams are user-created with custom colors. Should these override CSS vars dynamically?
3. **Recharts + CSS vars** — Recharts accepts CSS `var()` in some props but not all. May need `getComputedStyle()` helper for full support.
