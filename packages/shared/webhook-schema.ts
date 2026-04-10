// Desktop telemetry webhook payload schema (shared between api validation
// and any future web typing). Strict: unknown top-level fields are rejected.
import { z } from 'zod'

const deviceInfoSchema = z.object({
  device_id: z.uuid(),
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
  resets_at: z.iso.datetime(),
})

const profileSchema = z.object({
  name: z.string(),
  email: z.email(),
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
  sessionId: z.uuid(),
  model: z.string(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime(),
  totalInputTokens: z.number().int().nonnegative(),
  totalOutputTokens: z.number().int().nonnegative(),
  totalCacheRead: z.number().int().nonnegative(),
  totalCacheWrite: z.number().int().nonnegative(),
  messageCount: z.number().int().nonnegative(),
})

export const usageReportSchema = z
  .object({
    event: z.literal('usage_report'),
    timestamp: z.iso.datetime(),
    app_version: z.string(),
    member_email: z.email(),
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
  })
  .strict()

export type UsageReportPayload = z.infer<typeof usageReportSchema>
