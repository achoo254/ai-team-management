---
phase: 4
priority: medium
status: completed
effort: M
---

# Phase 4: Hooks Tests

## Overview

Test React custom hooks using `@testing-library/react` `renderHook`. Mock API calls via `fetch` mock (hooks call `lib/api-client.ts` which uses `fetch`).

## Environment

- Runs in `jsdom` (React hooks need DOM)
- Mock `fetch` responses — hooks don't touch DB directly
- Wrap with `QueryClientProvider` (TanStack Query)

## Test Wrapper

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

export function createTestQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

## Hooks to Test

| Hook | File | Key Tests |
|------|------|-----------|
| `use-seats` | `tests/hooks/use-seats.test.ts` | Fetches seats, creates seat, assigns user |
| `use-teams` | `tests/hooks/use-teams.test.ts` | Fetches teams, CRUD operations |
| `use-schedules` | `tests/hooks/use-schedules.test.ts` | Fetches schedules, assign/swap slots |
| `use-dashboard` | `tests/hooks/use-dashboard.test.ts` | Fetches summary, enhanced stats |
| `use-admin` | `tests/hooks/use-admin.test.ts` | User management, bulk actions |
| `use-alerts` | `tests/hooks/use-alerts.test.ts` | Fetches alerts, resolve alert |
| `use-usage-log` | `tests/hooks/use-usage-log.test.ts` | Week navigation, bulk update |
| `use-auth` | `tests/hooks/use-auth.test.ts` | Auth context values |

## Mock Strategy

- Mock `global.fetch` to return expected JSON responses
- No real API/DB calls from hooks tests
- Test loading states, error states, success states

## Files to Create

- `tests/helpers/query-wrapper.tsx`
- `tests/hooks/use-seats.test.ts`
- `tests/hooks/use-teams.test.ts`
- `tests/hooks/use-schedules.test.ts`
- `tests/hooks/use-dashboard.test.ts`
- `tests/hooks/use-admin.test.ts`
- `tests/hooks/use-alerts.test.ts`
- `tests/hooks/use-usage-log.test.ts`
- `tests/hooks/use-auth.test.ts`

## Success Criteria

- [ ] Each hook tested for success + error states
- [ ] TanStack Query caching behavior verified
- [ ] No real network calls
