# Phase 4: Route Rename & Cleanup

## Priority: Medium | Status: completed

## Overview
Rename `/usage-metrics` → `/usage` in router and all nav components. Final cleanup.

## Files to Modify
- `packages/web/src/app.tsx` — Rename route path
- `packages/web/src/components/app-sidebar.tsx` — Update nav link: remove "Log Usage", rename "Usage Metrics" → "Usage"
- `packages/web/src/components/mobile-nav.tsx` — Update nav link
- `packages/web/src/components/header.tsx` — Update page title mapping
- `packages/web/src/pages/usage-metrics.tsx` — Optional: rename file to `usage.tsx` for consistency

## Implementation Steps

### 1. Update `app.tsx` router

```tsx
// Remove: <Route path="log-usage" element={<LogUsagePage />} />  (done in phase 3)
// Change:
<Route path="usage" element={<UsageMetricsPage />} />
// Add redirect for old URL:
<Route path="usage-metrics" element={<Navigate to="/usage" replace />} />
```

### 2. Update `app-sidebar.tsx`

Remove the log-usage nav item. Rename usage-metrics:
```ts
// Remove: { label: "Log Usage", href: "/log-usage", icon: BarChart3 },
// Change: { label: "Usage", href: "/usage", icon: Activity },
```

### 3. Update `mobile-nav.tsx`

Remove log-usage link. Add/update usage link if needed:
```ts
// Remove: { label: "Log", href: "/log-usage", icon: BarChart3 },
// Ensure: { label: "Usage", href: "/usage", icon: Activity },
```

### 4. Update `header.tsx`

Update page title mapping:
```ts
// Remove: "/log-usage": "Log Usage",
// Change: "/usage": "Usage",
// Remove: "/usage-metrics": "Usage Metrics",
```

### 5. Optional: Rename page file

`pages/usage-metrics.tsx` → `pages/usage.tsx` for consistency. Update import in app.tsx.

### 6. DB Cleanup note

For deployment, run:
```js
db.usage_logs.drop()
```
This can be done via `mongosh` or added to a migration script.

## Review Feedback Applied
- **H1 fix**: Route consolidation completed with `/usage` as final endpoint (from `/usage-metrics`)
- **M1/M2 fix**: Navigation updated across app-sidebar, mobile-nav, and header components
- **L1/L2 fix**: Page component renamed to UsagePage for consistency with new route structure

## Todo
- [x] Rename route in app.tsx (usage-metrics → usage)
- [x] Add redirect from /usage-metrics to /usage
- [x] Update app-sidebar.tsx — remove log-usage, rename usage-metrics
- [x] Update mobile-nav.tsx — remove log-usage link
- [x] Update header.tsx — update title mapping
- [x] Optional: rename usage-metrics.tsx → usage.tsx
- [x] Run `pnpm build` to verify
- [x] Run `pnpm test` to verify

## Success Criteria
- `/usage` shows the usage metrics page
- `/usage-metrics` redirects to `/usage`
- No "Log Usage" in nav
- Nav shows "Usage" instead of "Usage Metrics"
- `pnpm build` passes
- `pnpm test` passes
