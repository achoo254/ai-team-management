---
phase: 2
status: complete
priority: medium
effort: 30m
---

# Phase 2 — Theme System Cleanup

## Context

- `theme.ts` — old 6-line init function, only runs on page load
- `theme-toggle.tsx` — new component with full light/dark/system support + OS listener
- Both exist but `theme.ts` is redundant if `theme-toggle.tsx` handles everything

## Analysis

`theme-toggle.tsx` already:
- Reads localStorage preference
- Supports `system` mode with `matchMedia` listener
- Handles toggle via dropdown

`theme.ts` `initTheme()` is called somewhere on app startup. Need to check usage.

## Implementation Steps

### Step 1 — Verify `initTheme()` usage

Grep for `initTheme` imports. If only called in `main.tsx` or `app.tsx`, replace with inline init.

### Step 2 — Update `theme.ts` to sync with `theme-toggle.tsx` logic

Replace `theme.ts` content to reuse same logic:

```ts
/** Initialize theme from localStorage or system preference.
 *  Called once at app startup before React mounts. */
export function initTheme() {
  const saved = localStorage.getItem("theme") as "light" | "dark" | null;
  const isDark =
    saved === "dark" ||
    (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function getTheme(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
```

This is essentially what exists now. The key change: ensure `theme === "system"` (stored as `null` in localStorage) is handled consistently between `theme.ts` and `theme-toggle.tsx`.

### Step 3 — Add `color-scheme` CSS property

In `tailwind.css` `@layer base`:

```css
html {
  @apply font-sans;
  color-scheme: light;
}
html.dark {
  color-scheme: dark;
}
```

This ensures native form elements (scrollbars, inputs) match the theme.

## Success Criteria

- [x] `initTheme()` and `ThemeToggle` use consistent localStorage key behavior
- [x] `color-scheme` CSS property set for native element theming
- [x] No duplicate theme logic between files

## Risk

Low — cosmetic improvement only.
