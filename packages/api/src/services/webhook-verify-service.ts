// HMAC + timestamp window verification for desktop telemetry webhook.
// Clients sign: HMAC_SHA256(api_key, `${timestamp}.${rawBody}`).
import { createHmac, timingSafeEqual } from 'crypto'
import { decrypt } from '../lib/encryption.js'
import { Device, type IDevice } from '../models/device.js'

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000 // ±5 min

export type VerifyResult =
  | { ok: true; device: IDevice }
  | { ok: false; status: number; error: string }

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

  // MUST select the encrypted key explicitly (schema has select:false)
  const device = await Device.findOne({ device_id: deviceId }).select('+api_key_encrypted')

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
  // signatureHeader must be valid hex of matching length
  if (!/^[0-9a-f]+$/i.test(signatureHeader)) {
    return { ok: false, status: 401, error: 'Invalid signature format' }
  }
  const providedBuf = Buffer.from(signatureHeader, 'hex')
  if (expectedBuf.length !== providedBuf.length) {
    return { ok: false, status: 401, error: 'Signature mismatch' }
  }
  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return { ok: false, status: 401, error: 'Signature mismatch' }
  }

  return { ok: true, device }
}
