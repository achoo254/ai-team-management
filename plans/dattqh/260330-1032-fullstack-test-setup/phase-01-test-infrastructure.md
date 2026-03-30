---
phase: 1
priority: critical
status: completed
effort: S
---

# Phase 1: Test Infrastructure Setup

## Overview

Install dependencies, configure Vitest, setup real MongoDB test connection, create test utilities.

## Context

- Project: Next.js 16 + TypeScript + Mongoose 9
- DB connection: `lib/mongoose.ts` — singleton pattern with global cache
- Auth: JWT-based via `lib/auth.ts` — `signToken()`, `getAuthUser()`
- API helper: `lib/api-helpers.ts` — `withAuth()`, `withAdmin()`, `errorResponse()`

## Implementation Steps

### 1. Install dev dependencies

```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

### 2. Create `vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environmentMatchGlobs: [
      // API route tests run in node, not jsdom
      ["tests/api/**", "node"],
      ["tests/services/**", "node"],
    ],
    env: {
      MONGO_URI: "mongodb://localhost:27017/ai_team_management_test_db",
      JWT_SECRET: "test-secret-for-vitest",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

### 3. Create `tests/setup.ts`

Global setup: connect to real MongoDB before all, disconnect after all.

```ts
import { beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";

beforeAll(async () => {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/ai_team_management_test_db";
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});
```

### 4. Create `tests/helpers/auth-helper.ts`

Generate real JWT tokens for test requests.

```ts
import jwt from "jsonwebtoken";
import type { JwtPayload } from "@/lib/auth";

const TEST_SECRET = "test-secret-for-vitest";

export function createTestToken(overrides?: Partial<JwtPayload>): string {
  const payload: JwtPayload = {
    _id: "507f1f77bcf86cd799439011",
    name: "Test Admin",
    email: "admin@test.com",
    role: "admin",
    team: "dev",
    ...overrides,
  };
  return jwt.sign(payload, TEST_SECRET, { expiresIn: "1h" });
}

export function createUserToken(overrides?: Partial<JwtPayload>): string {
  return createTestToken({ role: "user", name: "Test User", email: "user@test.com", ...overrides });
}
```

### 5. Create `tests/helpers/db-helper.ts`

Seed and cleanup utilities using real Mongoose models.

```ts
import { Seat } from "@/models/seat";
import { User } from "@/models/user";
import { Team } from "@/models/team";
import { Schedule } from "@/models/schedule";
import { Alert } from "@/models/alert";
import { UsageLog } from "@/models/usage-log";
import mongoose from "mongoose";

const allModels = [Seat, User, Team, Schedule, Alert, UsageLog];

/** Drop all collections — call in beforeEach or afterEach */
export async function cleanDb() {
  await Promise.all(allModels.map((m) => m.deleteMany({})));
}

/** Seed minimal test data, return created docs */
export async function seedTestData() {
  const team = await Team.create({ name: "dev", label: "Dev", color: "#3b82f6" });
  const seat = await Seat.create({ email: "test@test.com", label: "Test Seat", team: "dev", max_users: 2 });
  const user = await User.create({ name: "Test User", email: "test@test.com", role: "admin", team: "dev", seat_id: seat._id });
  return { team, seat, user };
}
```

### 6. Add test scripts to `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

### 7. Create `.env.test` (gitignored)

```
MONGO_URI=mongodb://localhost:27017/ai_team_management_test_db
JWT_SECRET=test-secret-for-vitest
```

## Files to Create

- `vitest.config.ts`
- `tests/setup.ts`
- `tests/helpers/auth-helper.ts`
- `tests/helpers/db-helper.ts`
- `.env.test`

## Files to Modify

- `package.json` — add test scripts + devDependencies

## Success Criteria

- [ ] `pnpm test` runs without error (0 tests, 0 failures)
- [ ] Vitest connects to real MongoDB test database
- [ ] Path alias `@/` resolves correctly
- [ ] API tests run in `node` env, UI tests in `jsdom`

## Risks

- MongoDB not running locally → document how to start or use Atlas
- Mongoose global cache may interfere between test files → ensure proper cleanup
