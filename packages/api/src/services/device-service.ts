// Device registration + key management for desktop telemetry webhook.
// The plaintext API key is returned ONCE at creation time — never retrievable later.
import { randomBytes, randomUUID } from 'crypto'
import type { Types } from 'mongoose'
import { encrypt } from '../lib/encryption.js'
import { Device, type IDevice } from '../models/device.js'

export interface CreatedDevice {
  device: IDevice
  plaintext_api_key: string // returned ONCE — caller must surface to user
}

/** Generate API key: `dsk_` + 32 random bytes base64url (~43 chars body). */
function generateApiKey(): string {
  const body = randomBytes(32).toString('base64url')
  return `dsk_${body}`
}

export async function createDevice(params: {
  user_id: Types.ObjectId
  device_name?: string
  hostname?: string
}): Promise<CreatedDevice> {
  const plaintext = generateApiKey()
  const device = await Device.create({
    device_id: randomUUID(),
    user_id: params.user_id,
    device_name: params.device_name || 'Pending setup',
    hostname: params.hostname || 'pending',
    system_info: {
      os_name: '',
      os_version: '',
      cpu_name: '',
      cpu_cores: 0,
      ram_total_mb: 0,
      arch: '',
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
