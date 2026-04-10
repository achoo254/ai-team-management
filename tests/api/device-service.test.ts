import { describe, expect, it, vi } from 'vitest'

// Mock encryption so createDevice doesn't need ENCRYPTION_KEY env
vi.mock('../../packages/api/src/lib/encryption.js', () => ({
  encrypt: (t: string) => `enc:${t}`,
  decrypt: (s: string) => s.replace(/^enc:/, ''),
  isEncryptionConfigured: () => true,
}))

// Mock Device.create to capture what was passed and return a fake doc
const createCalls: Array<Record<string, unknown>> = []
vi.mock('../../packages/api/src/models/device.js', () => ({
  Device: {
    create: async (doc: Record<string, unknown>) => {
      createCalls.push(doc)
      return { ...doc, _id: 'fake-id', toJSON: () => ({ ...doc, _id: 'fake-id' }) }
    },
  },
}))

import mongoose from 'mongoose'
import { createDevice } from '../../packages/api/src/services/device-service.js'

describe('createDevice', () => {
  it('generates api key with dsk_ prefix', async () => {
    const { plaintext_api_key } = await createDevice({
      user_id: new mongoose.Types.ObjectId(),
      device_name: 'laptop',
      hostname: 'host',
    })
    expect(plaintext_api_key).toMatch(/^dsk_/)
    expect(plaintext_api_key.length).toBeGreaterThan(30)
  })

  it('generates unique keys across calls', async () => {
    const keys = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const { plaintext_api_key } = await createDevice({
        user_id: new mongoose.Types.ObjectId(),
        device_name: `d${i}`,
        hostname: 'h',
      })
      keys.add(plaintext_api_key)
    }
    expect(keys.size).toBe(5)
  })

  it('stores encrypted key and api_key_prefix (first 12 chars)', async () => {
    createCalls.length = 0
    const { plaintext_api_key } = await createDevice({
      user_id: new mongoose.Types.ObjectId(),
      device_name: 'laptop',
      hostname: 'host',
    })
    const captured = createCalls[createCalls.length - 1]
    expect(captured.api_key_encrypted).toBe(`enc:${plaintext_api_key}`)
    expect(captured.api_key_prefix).toBe(plaintext_api_key.slice(0, 12))
    expect(captured.device_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })
})
