# Phase 2: Models, Services & Lib

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 1.5 days
- **Description:** Migrate Mongoose models (JS→TS), services, and shared lib (DB connection, auth, Firebase)

## Key Insights
- 6 Mongoose models with compound indexes and enums
- 4 services: alert, telegram, usage-sync, anthropic
- Mongoose in serverless needs singleton pattern to avoid connection leaks
- JWT auth logic stays same — just TypeScript wrapper

## Requirements

### Functional
- All 6 models converted to TypeScript with proper interfaces
- Mongoose singleton connection for serverless
- All 4 services converted with async/await patterns
- Firebase Admin SDK init (server-side only)
- Firebase Client SDK config (client-side)
- JWT sign/verify utilities

### Non-functional
- Each model file < 60 lines
- Each service file < 100 lines
- Proper error typing

## Related Code Files

### Source (to migrate from)
- `server/models/seat-model.js` → `models/seat.ts`
- `server/models/user-model.js` → `models/user.ts`
- `server/models/usage-log-model.js` → `models/usage-log.ts`
- `server/models/schedule-model.js` → `models/schedule.ts`
- `server/models/alert-model.js` → `models/alert.ts`
- `server/models/team-model.js` → `models/team.ts`
- `server/services/alert-service.js` → `services/alert-service.ts`
- `server/services/telegram-service.js` → `services/telegram-service.ts`
- `server/services/usage-sync-service.js` → `services/usage-sync-service.ts`
- `server/services/anthropic-service.js` → `services/anthropic-service.ts`
- `server/db/database.js` → `lib/mongoose.ts`
- `server/db/migrations.js` → `lib/seed-data.ts`
- `server/config.js` → use `process.env` directly or `lib/config.ts`
- `server/lib/firebase-admin-init.js` → `lib/firebase-admin.ts`
- `server/middleware/auth-middleware.js` → `lib/auth.ts`

### Files to Create
- `lib/mongoose.ts` — Singleton connection
- `lib/firebase-admin.ts` — Firebase Admin init
- `lib/firebase-client.ts` — Firebase client config (NEXT_PUBLIC_ vars)
- `lib/auth.ts` — JWT verify, auth helpers for Route Handlers
- `lib/config.ts` — Typed env config
- `lib/seed-data.ts` — Seed function
- `models/*.ts` — 6 model files
- `services/*.ts` — 4 service files

## Implementation Steps

1. **Create lib/mongoose.ts** — Singleton pattern for serverless
   ```typescript
   import mongoose from 'mongoose'
   const MONGO_URI = process.env.MONGO_URI!
   let cached = global.mongoose
   if (!cached) cached = global.mongoose = { conn: null, promise: null }
   export async function connectDb() {
     if (cached.conn) return cached.conn
     if (!cached.promise) {
       cached.promise = mongoose.connect(MONGO_URI)
     }
     cached.conn = await cached.promise
     return cached.conn
   }
   ```

2. **Create lib/config.ts** — Typed env access
   ```typescript
   export const config = {
     mongoUri: process.env.MONGO_URI!,
     jwtSecret: process.env.JWT_SECRET!,
     appUrl: process.env.APP_URL || 'http://localhost:3000',
     alerts: { highUsagePct: 80, inactivityWeeks: 1 },
     telegram: {
       botToken: process.env.TELEGRAM_BOT_TOKEN || '',
       chatId: process.env.TELEGRAM_CHAT_ID || '',
       topicId: process.env.TELEGRAM_TOPIC_ID || '',
     }
   }
   ```

3. **Migrate 6 models** — Keep exact same schema, add TS interfaces
   - Each file exports: interface + model
   - Pattern: `export interface ISeat { ... }` + `export const Seat = models.Seat || model<ISeat>('Seat', schema)`
   - Preserve all indexes, enums, defaults, timestamps

4. **Create lib/auth.ts** — Auth utilities for Route Handlers
   ```typescript
   export async function getAuthUser(request: NextRequest): Promise<IUser | null>
   // Read JWT from cookie 'token' or Authorization header
   // Verify with jsonwebtoken
   // Return user object or null

   export function requireAuth(request: NextRequest): IUser
   // Throws if not authenticated

   export function requireAdmin(request: NextRequest): IUser
   // Throws if not admin
   ```

5. **Create lib/firebase-admin.ts** — Server-side Firebase
   - Init from service account JSON (same as current)
   - Export `adminAuth` for token verification

6. **Create lib/firebase-client.ts** — Client-side Firebase
   - Use NEXT_PUBLIC_ env vars
   - Export `auth`, `googleProvider` for login page

7. **Migrate 4 services** — Keep logic, add types
   - `alert-service.ts`: `checkAlerts()`, `insertIfNew()`
   - `telegram-service.ts`: `sendWeeklyReport()`, `sendLogReminder()`, `sendMessage()`
   - `usage-sync-service.ts`: `getCurrentWeekStart()`, `logUsage()`
   - `anthropic-service.ts`: `getClaudeCodeUsage()`, `getMembers()`

8. **Create lib/seed-data.ts** — Migrate seed function

## Todo List

- [ ] Create lib/mongoose.ts (singleton pattern)
- [ ] Create lib/config.ts (typed env)
- [ ] Migrate 6 Mongoose models to TypeScript
- [ ] Create lib/auth.ts (JWT verify + helpers)
- [ ] Create lib/firebase-admin.ts
- [ ] Create lib/firebase-client.ts
- [ ] Migrate alert-service.ts
- [ ] Migrate telegram-service.ts
- [ ] Migrate usage-sync-service.ts
- [ ] Migrate anthropic-service.ts
- [ ] Create lib/seed-data.ts
- [ ] Verify all imports resolve, `pnpm build` passes

## Success Criteria
- All models compile with correct types
- `connectDb()` works in serverless context
- Auth helpers correctly parse JWT from cookies
- Services pass TypeScript strict checks
- No circular dependencies

## Risk Assessment
- **Mongoose global cache**: Must use `global.mongoose` pattern to avoid multiple connections in dev (Next.js hot reload)
- **Firebase service account path**: May need to inline JSON via env var instead of file path in serverless

## Next Steps
→ Phase 3: Migrate API route handlers
