# Phase 1: Setup Dependencies + Shared Zod Schema

## Overview
- Priority: HIGH (blocks all subsequent phases)
- Status: completed

## Tasks

### 1.1 Install dependencies
```bash
pnpm -F @repo/api add zod express-rate-limit
pnpm -F @repo/shared add zod
```

### 1.2 Create shared Zod schema
File: `packages/shared/webhook-schema.ts` (new, <150 LOC)

Export:
- `usageReportSchema` — Zod schema matching payload đầy đủ (device_info, system_info, data.profiles, session_usage.sessions)
- `UsageReportPayload` type (z.infer)
- Strict mode: reject unknown top-level fields

Schema shape:
```ts
import { z } from 'zod'

const deviceInfoSchema = z.object({
  device_id: z.string().uuid(),
  device_name: z.string().min(1).max(200),
  hostname: z.string().min(1).max(200),
})

const systemInfoSchema = z.object({
  os_name: z.string(),
  os_version: z.string(),
  hostname: z.string(),
  cpu_name: z.string(),
  cpu_cores: z.number().int().positive(),
  ram_total_mb: z.number().int().positive(),
  ram_used_mb: z.number().int().nonnegative(),
  arch: z.string(),
})

const profileUsageWindowSchema = z.object({
  utilization: z.number().min(0).max(100),
  resets_at: z.string().datetime(),
})

const profileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  subscription_type: z.string(),
  rate_limit_tier: z.string(),
  is_active: z.boolean(),
  is_expired: z.boolean(),
  usage: z.object({
    five_hour: profileUsageWindowSchema.optional(),
    seven_day: profileUsageWindowSchema.optional(),
    seven_day_sonnet: profileUsageWindowSchema.optional(),
  }),
})

const sessionSchema = z.object({
  sessionId: z.string().uuid(),
  model: z.string(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalCacheRead: z.number().int().nonnegative(),
  totalCacheWrite: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
})

export const usageReportSchema = z.object({
  event: z.literal('usage_report'),
  timestamp: z.string().datetime(),
  app_version: z.string(),
  member_email: z.string().email(),
  device_info: deviceInfoSchema,
  system_info: systemInfoSchema,
  data: z.object({ profiles: z.array(profileSchema) }),
  session_usage: z.object({
    period: z.string(),
    summary: z.object({
      totalInputTokens: z.number().int().nonnegative(),
      totalOutputTokens: z.number().int().nonnegative(),
      totalCacheRead: z.number().int().nonnegative(),
      totalCacheWrite: z.number().int().nonnegative(),
      sessionCount: z.number().int().nonnegative(),
    }),
    sessions: z.array(sessionSchema),
  }),
}).strict()

export type UsageReportPayload = z.infer<typeof usageReportSchema>
```

### 1.3 Export from shared index
Update `packages/shared/package.json` exports if needed để `@repo/shared/webhook-schema` resolvable. Check existing pattern với `types.ts` và `credential-parser.ts`.

## Acceptance
- `pnpm -F @repo/api build` passes (typecheck)
- Schema parse thành công với sample payload trong brainstorm report
- Schema reject payload thiếu field bắt buộc

## Todo
- [x] Install zod + express-rate-limit
- [x] Create `packages/shared/webhook-schema.ts`
- [x] Verify export path resolvable từ api package
- [x] Typecheck pass
