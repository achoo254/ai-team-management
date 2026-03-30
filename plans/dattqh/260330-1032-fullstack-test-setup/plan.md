---
status: completed
created: 2026-03-30
completed: 2026-03-30
branch: main
blockedBy: []
blocks: []
---

# Full-Stack Test Setup (Vitest + Real MongoDB + Mongoose)

## Overview

Setup testing infrastructure cho project Next.js App Router. Sử dụng Vitest + real MongoDB instance (Mongoose) + React Testing Library.

**Scope:** Test config, API routes, hooks, services, UI components.

## Phases

| # | Phase | Priority | Effort | Status |
|---|-------|----------|--------|--------|
| 1 | [Test infrastructure setup](./phase-01-test-infrastructure.md) | Critical | S | Done |
| 2 | [API route tests](./phase-02-api-route-tests.md) | Critical | M | Done |
| 3 | [Services tests](./phase-03-services-tests.md) | High | S | Done |
| 4 | [Hooks tests](./phase-04-hooks-tests.md) | Medium | M | Done |
| 5 | [UI component tests](./phase-05-ui-component-tests.md) | Medium | M | Done |

## Key Decisions

- **Real MongoDB** (not mongodb-memory-server) — accuracy over convenience
- **Vitest** — fast, native TS, compatible with Next.js
- **Separate test DB** — `ai_team_management_test_db`, seed/cleanup per suite
- **JWT mock strategy** — generate real JWT tokens with test secret, no mock

## Dependencies

- MongoDB instance running locally or remote
- `.env.test` with `MONGO_URI` pointing to test database

## Cook Command

```bash
/cook D:/CONG VIEC/ai-team-management/plans/dattqh/260330-1032-fullstack-test-setup/plan.md
```
