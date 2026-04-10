// Ingest validated desktop webhook payload: update device snapshot + upsert claude sessions.
// Attribution strategy: "first-sight-wins" — profile_email/seat_id frozen at first insert.
// Rationale: Claude CLI jsonl lacks per-session profile pointer. Desktop fires event-driven
// on_change, so new sessions get picked up while the correct profile is active. Edge case
// (user switches profile mid-session without firing on_change) is accepted — see plan.
import type { Types } from 'mongoose'
import { ClaudeSession } from '../models/claude-session.js'
import type { IDevice } from '../models/device.js'
import { Seat } from '../models/seat.js'
import type { UsageReportPayload } from '@repo/shared/webhook-schema'

export interface IngestResult {
  accepted_sessions: number
  device_updated: boolean
}

type Profile = UsageReportPayload['data']['profiles'][number]

/** Pick the active profile, fallback to profiles[0]. Returns null when profiles empty. */
function resolveActiveProfile(payload: UsageReportPayload): Profile | null {
  const profiles = payload.data.profiles
  if (profiles.length === 0) return null
  const actives = profiles.filter((p) => p.is_active)
  if (actives.length > 1) {
    console.warn(
      `[webhook-ingest] multiple active profiles (${actives.length}) for device ${payload.device_info.device_id} — picking first`,
    )
  }
  return actives[0] ?? profiles[0]
}

async function resolveSeatIdByEmail(email: string): Promise<Types.ObjectId | null> {
  const seat = await Seat.findOne({ email }).select('_id').lean()
  return (seat?._id as Types.ObjectId | undefined) ?? null
}

async function updateDeviceSnapshot(device: IDevice, payload: UsageReportPayload): Promise<void> {
  device.device_name = payload.device_info.device_name
  device.hostname = payload.device_info.hostname
  device.system_info = {
    os_name: payload.system_info.os_name,
    os_version: payload.system_info.os_version,
    cpu_name: payload.system_info.cpu_name,
    cpu_cores: payload.system_info.cpu_cores,
    ram_total_mb: payload.system_info.ram_total_mb,
    arch: payload.system_info.arch,
  }
  device.app_version = payload.app_version
  device.last_ram_used_mb = payload.system_info.ram_used_mb
  device.last_seen_at = new Date()
  await device.save()
}

export async function ingestUsageReport(
  device: IDevice,
  user_id: Types.ObjectId,
  payload: UsageReportPayload,
): Promise<IngestResult> {
  await updateDeviceSnapshot(device, payload)

  // Early exit: no profiles → cannot attribute sessions (ClaudeSession.profile_email is required)
  const active = resolveActiveProfile(payload)
  if (!active) {
    return { accepted_sessions: 0, device_updated: true }
  }

  const activeSeatId = await resolveSeatIdByEmail(active.email)
  const usage = active.usage

  // Upsert sessions by session_id (idempotent). Attribution fields ($setOnInsert)
  // are frozen at first insert; usage/token fields ($set) update on every re-ingest.
  let accepted = 0
  for (const s of payload.session_usage.sessions) {
    await ClaudeSession.findOneAndUpdate(
      { session_id: s.sessionId },
      {
        $setOnInsert: {
          session_id: s.sessionId,
          device_id: device._id,
          user_id,
          seat_id: activeSeatId,
          profile_email: active.email,
        },
        $set: {
          subscription_type: active.subscription_type,
          rate_limit_tier: active.rate_limit_tier,
          model: s.model,
          started_at: new Date(s.startedAt),
          ended_at: new Date(s.endedAt),
          total_input_tokens: s.totalInputTokens,
          total_output_tokens: s.totalOutputTokens,
          total_cache_read: s.totalCacheRead,
          total_cache_write: s.totalCacheWrite,
          message_count: s.messageCount,
          usage_five_hour_pct: usage.five_hour?.utilization ?? null,
          usage_seven_day_pct: usage.seven_day?.utilization ?? null,
          usage_seven_day_sonnet_pct: usage.seven_day_sonnet?.utilization ?? null,
          received_at: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    accepted++
  }

  return { accepted_sessions: accepted, device_updated: true }
}
