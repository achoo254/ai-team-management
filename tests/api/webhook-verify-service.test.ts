import { createHmac } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock encryption.decrypt — we return a fixed plaintext key so tests can sign with it.
vi.mock('../../packages/api/src/lib/encryption.js', () => ({
  encrypt: (t: string) => `enc:${t}`,
  decrypt: (s: string) => s.replace(/^enc:/, ''),
  isEncryptionConfigured: () => true,
}))

// Mock Device model — we control what findOne(...).select(...) returns per test.
const findOneMock = vi.fn()
vi.mock('../../packages/api/src/models/device.js', () => ({
  Device: {
    findOne: (...args: unknown[]) => findOneMock(...args),
  },
}))

import { verifyWebhookRequest } from '../../packages/api/src/services/webhook-verify-service.js'

const API_KEY = 'dsk_testkey_abc123'

function makeDevice(overrides: Record<string, unknown> = {}) {
  return {
    device_id: 'dev-1',
    api_key_encrypted: `enc:${API_KEY}`,
    revoked_at: null,
    user_id: 'user-1',
    ...overrides,
  }
}

function stubDeviceQuery(device: unknown | null) {
  findOneMock.mockReturnValue({ select: () => Promise.resolve(device) })
}

function sign(key: string, body: string, ts: number) {
  return createHmac('sha256', key).update(`${ts}.${body}`).digest('hex')
}

describe('verifyWebhookRequest', () => {
  beforeEach(() => {
    findOneMock.mockReset()
  })

  it('returns ok=true with valid headers + signature', async () => {
    stubDeviceQuery(makeDevice())
    const now = Date.now()
    const body = '{"hello":"world"}'
    const res = await verifyWebhookRequest({
      deviceId: 'dev-1',
      timestampHeader: String(now),
      signatureHeader: sign(API_KEY, body, now),
      rawBody: body,
      now,
    })
    expect(res.ok).toBe(true)
  })

  it('401 when headers missing', async () => {
    const res = await verifyWebhookRequest({
      deviceId: undefined,
      timestampHeader: '1',
      signatureHeader: 'x',
      rawBody: '',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.status).toBe(401)
  })

  it('401 when timestamp is non-numeric', async () => {
    const res = await verifyWebhookRequest({
      deviceId: 'dev-1',
      timestampHeader: 'not-a-number',
      signatureHeader: 'aabb',
      rawBody: '',
    })
    expect(res.ok).toBe(false)
  })

  it('401 when timestamp outside ±5min window', async () => {
    const now = Date.now()
    const stale = now - 10 * 60 * 1000
    const res = await verifyWebhookRequest({
      deviceId: 'dev-1',
      timestampHeader: String(stale),
      signatureHeader: sign(API_KEY, '', stale),
      rawBody: '',
      now,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/window/i)
  })

  it('401 when device not found', async () => {
    stubDeviceQuery(null)
    const now = Date.now()
    const res = await verifyWebhookRequest({
      deviceId: 'unknown',
      timestampHeader: String(now),
      signatureHeader: sign(API_KEY, '', now),
      rawBody: '',
      now,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/unknown/i)
  })

  it('401 when device is revoked', async () => {
    stubDeviceQuery(makeDevice({ revoked_at: new Date() }))
    const now = Date.now()
    const res = await verifyWebhookRequest({
      deviceId: 'dev-1',
      timestampHeader: String(now),
      signatureHeader: sign(API_KEY, '', now),
      rawBody: '',
      now,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toMatch(/revoked/i)
  })

  it('401 on signature mismatch (correct length, wrong bytes)', async () => {
    stubDeviceQuery(makeDevice())
    const now = Date.now()
    const badSig = 'a'.repeat(64) // 32 bytes hex
    const res = await verifyWebhookRequest({
      deviceId: 'dev-1',
      timestampHeader: String(now),
      signatureHeader: badSig,
      rawBody: 'body',
      now,
    })
    expect(res.ok).toBe(false)
  })

  it('401 on non-hex signature format', async () => {
    stubDeviceQuery(makeDevice())
    const now = Date.now()
    const res = await verifyWebhookRequest({
      deviceId: 'dev-1',
      timestampHeader: String(now),
      signatureHeader: 'not$$hex!!',
      rawBody: 'body',
      now,
    })
    expect(res.ok).toBe(false)
  })

  it('401 on signature wrong length', async () => {
    stubDeviceQuery(makeDevice())
    const now = Date.now()
    const res = await verifyWebhookRequest({
      deviceId: 'dev-1',
      timestampHeader: String(now),
      signatureHeader: 'abcd', // 2 bytes, not 32
      rawBody: 'body',
      now,
    })
    expect(res.ok).toBe(false)
  })

  it('body tampering invalidates signature', async () => {
    stubDeviceQuery(makeDevice())
    const now = Date.now()
    const signedBody = '{"x":1}'
    const sig = sign(API_KEY, signedBody, now)
    const res = await verifyWebhookRequest({
      deviceId: 'dev-1',
      timestampHeader: String(now),
      signatureHeader: sig,
      rawBody: '{"x":2}', // different
      now,
    })
    expect(res.ok).toBe(false)
  })
})
