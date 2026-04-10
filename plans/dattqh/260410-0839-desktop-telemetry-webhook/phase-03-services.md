# Phase 3: Services — Device + Webhook Verify

## Overview
- Priority: HIGH
- Status: completed
- Depends on: Phase 2

## Files to Create

### 3.1 `packages/api/src/services/device-service.ts` (<150 LOC)

Responsibilities: API key generation, device CRUD helpers, plaintext key returned ONCE.

```ts
import { randomBytes, randomUUID } from 'crypto'
import { encrypt } from '../lib/encryption.js'
import { Device, type IDevice } from '../models/device.js'
import type { Types } from 'mongoose'

export interface CreatedDevice {
  device: IDevice
  plaintext_api_key: string  // returned ONCE — caller must surface to user
}

/** Generate API key: dsk_ + 32 bytes base64url (~43 chars body). */
function generateApiKey(): string {
  const body = randomBytes(32).toString('base64url')
  return `dsk_${body}`
}

export async function createDevice(params: {
  user_id: Types.ObjectId
  device_name: string
  hostname: string
}): Promise<CreatedDevice> {
  const plaintext = generateApiKey()
  const device = await Device.create({
    device_id: randomUUID(),
    user_id: params.user_id,
    device_name: params.device_name,
    hostname: params.hostname,
    system_info: {
      os_name: '', os_version: '', cpu_name: '',
      cpu_cores: 0, ram_total_mb: 0, arch: '',
    },
    api_key_encrypted: encrypt(plaintext),
    api_key_prefix: plaintext.slice(0, 12), // "dsk_xxxxxxxx"
  })
  return { device, plaintext_api_key: plaintext }
}

export async function listDevicesForUser(user_id: Types.ObjectId) {
  return Device.find({ user_id }).sort({ created_at: -1 })
}

export async function revokeDevice(device_pk: string, user_id: Types.ObjectId) {
  return Device.findOneAndUpdate(
    { _id: device_pk, user_id, revoked_at: null },
    { revoked_at: new Date() },
    { new: true },
  )
}
```

### 3.2 `packages/api/src/services/webhook-verify-service.ts` (<180 LOC)

Responsibilities: HMAC verification, timestamp window check, device lookup with decrypted key.

```ts
import { createHmac, timingSafeEqual } from 'crypto'
import { decrypt } from '../lib/encryption.js'
import { Device, type IDevice } from '../models/device.js'

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000 // ±5 min

export type VerifyResult =
  | { ok: true; device: IDevice }
  | { ok: false; status: number; error: string }

/**
 * Verify desktop webhook request.
 * Required headers: X-Device-Id, X-Timestamp (unix ms), X-Signature (hex)
 * Signature = HMAC_SHA256(api_key, `${timestamp}.${rawBody}`)
 */
export async function verifyWebhookRequest(params: {
  deviceId: string | undefined
  timestampHeader: string | undefined
  signatureHeader: string | undefined
  rawBody: string
  now?: number
}): Promise<VerifyResult> {
  const { deviceId, timestampHeader, signatureHeader, rawBody } = params
  const now = params.now ?? Date.now()

  if (!deviceId || !timestampHeader || !signatureHeader) {
    return { ok: false, status: 401, error: 'Missing auth headers' }
  }

  const timestamp = Number(timestampHeader)
  if (!Number.isFinite(timestamp)) {
    return { ok: false, status: 401, error: 'Invalid timestamp' }
  }
  if (Math.abs(now - timestamp) > TIMESTAMP_WINDOW_MS) {
    return { ok: false, status: 401, error: 'Timestamp out of window' }
  }

  // MUST select the encrypted key explicitly
  const device = await Device.findOne({ device_id: deviceId })
    .select('+api_key_encrypted')

  if (!device) return { ok: false, status: 401, error: 'Unknown device' }
  if (device.revoked_at) return { ok: false, status: 401, error: 'Device revoked' }

  let plaintextKey: string
  try {
    plaintextKey = decrypt(device.api_key_encrypted)
  } catch {
    return { ok: false, status: 500, error: 'Key decrypt failed' }
  }

  const expectedHex = createHmac('sha256', plaintextKey)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  const expectedBuf = Buffer.from(expectedHex, 'hex')
  let providedBuf: Buffer
  try {
    providedBuf = Buffer.from(signatureHeader, 'hex')
  } catch {
    return { ok: false, status: 401, error: 'Invalid signature format' }
  }
  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, status: 401, error: 'Signature mismatch' }
  }
  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, status: 401, error: 'Signature mismatch' }
  }

  return { ok: true, device }
}
```

### 3.3 `packages/api/src/services/webhook-ingest-service.ts` (<180 LOC)

Responsibilities: parse validated payload, upsert device + sessions, map seats.

```ts
import type { Types } from 'mongoose'
import { Device, type IDevice } from '../models/device.js'
import { ClaudeSession } from '../models/claude-session.js'
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
  // 1. Update device snapshot — device_info is source of truth for name/hostname
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

  // 2. Build profile_email → seat_id map
  const profileEmails = payload.data.profiles.map((p) => p.email)
  const seats = await Seat.find({ email: { $in: profileEmails } }).select('_id email')
  const seatByEmail = new Map(seats.map((s) => [s.email, s._id as Types.ObjectId]))

  // 3. Build profile_email → usage windows map
  const usageByEmail = new Map(
    payload.data.profiles.map((p) => [p.email, p]),
  )

  // 4. Upsert sessions. Note: payload doesn't carry per-session profile_email;
  //    we use the FIRST profile as the session owner (desktop app guarantees
  //    one active profile at a time). If multiple profiles, log warning.
  if (payload.data.profiles.length === 0) {
    return { accepted_sessions: 0, device_updated: true }
  }
  const primaryProfile = payload.data.profiles[0]
  const primaryEmail = primaryProfile.email
  const primarySeatId = seatByEmail.get(primaryEmail) ?? null
  const usage = usageByEmail.get(primaryEmail)?.usage

  let accepted = 0
  for (const s of payload.session_usage.sessions) {
    await ClaudeSession.findOneAndUpdate(
      { session_id: s.sessionId },
      {
        $set: {
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
          usage_five_hour_pct: usage?.five_hour?.utilization ?? null,
          usage_seven_day_pct: usage?.seven_day?.utilization ?? null,
          usage_seven_day_sonnet_pct: usage?.seven_day_sonnet?.utilization ?? null,
          received_at: new Date(),
        },
      },
      { upsert: true, new: true },
    )
    accepted++
  }

  return { accepted_sessions: accepted, device_updated: true }
}
```

**Note re multi-profile:** payload schema cho phép nhiều profiles nhưng sessions không carry profile_email. Quyết định: dùng profile[0] làm primary. Nếu desktop sau này gửi multi-profile thì cần extend payload (per-session profile pointer). Document trong code comment.

## Acceptance
- Typecheck pass
- All 3 service files < 200 LOC
- HMAC verify dùng `timingSafeEqual` (anti-timing attack)
- Encryption reuse `lib/encryption.ts` — không tạo crypto helper mới

## Todo
- [x] device-service.ts
- [x] webhook-verify-service.ts
- [x] webhook-ingest-service.ts
- [x] Typecheck pass
