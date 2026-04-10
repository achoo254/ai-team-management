// Ingest validated desktop webhook payload: update device snapshot + upsert claude sessions.
import type { Types } from 'mongoose'
import { ClaudeSession } from '../models/claude-session.js'
import type { IDevice } from '../models/device.js'
import { Seat } from '../models/seat.js'
import type { UsageReportPayload } from '@repo/shared/webhook-schema'

export interface IngestResult {
  accepted_sessions: number
  device_updated: boolean
}

export async function ingestUsageReport(
  device: IDevice,
  user_id: Types.ObjectId,
  payload: UsageReportPayload,
): Promise<IngestResult> {
  // 1. Device snapshot — device_info is source of truth for name/hostname
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

  // 2. Early exit when no profiles — nothing to attribute sessions to
  if (payload.data.profiles.length === 0) {
    return { accepted_sessions: 0, device_updated: true }
  }

  // 3. NOTE: payload schema carries multiple profiles but sessions lack per-session
  //    profile pointer. Desktop app guarantees one active profile at a time, so we
  //    use profile[0] as primary. If multi-profile support is ever needed, extend
  //    payload with per-session profile_email and update this logic.
  const primaryProfile = payload.data.profiles[0]
  const primaryEmail = primaryProfile.email

  const seat = await Seat.findOne({ email: primaryEmail }).select('_id')
  const primarySeatId = (seat?._id as Types.ObjectId | undefined) ?? null

  const usage = primaryProfile.usage

  // 4. Upsert sessions by session_id (idempotent)
  let accepted = 0
  for (const s of payload.session_usage.sessions) {
    await ClaudeSession.findOneAndUpdate(
      { session_id: s.sessionId },
      {
        $set: {
          session_id: s.sessionId,
          device_id: device._id,
          user_id,
          seat_id: primarySeatId,
          profile_email: primaryEmail,
          subscription_type: primaryProfile.subscription_type,
          rate_limit_tier: primaryProfile.rate_limit_tier,
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
