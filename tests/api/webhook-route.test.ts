// Route-level tests for POST /api/webhook/usage-report.
// Mocks verify service + ingest service + User model. Validates the
// orchestration layer (raw body → verify → json parse → zod → member_email
// check → ingest) using a minimal Express app.
import { createHmac } from 'crypto'
import type { Server } from 'http'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'
import express from '../../packages/api/node_modules/express/index.js'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Verify service: per-test override of ok/status/error/device.
const verifyMock = vi.fn()
vi.mock('../../packages/api/src/services/webhook-verify-service.js', () => ({
  verifyWebhookRequest: (...args: unknown[]) => verifyMock(...args),
}))

// Ingest service: capture payload + return stub result.
const ingestMock = vi.fn()
vi.mock('../../packages/api/src/services/webhook-ingest-service.js', () => ({
  ingestUsageReport: (...args: unknown[]) => ingestMock(...args),
}))

// User lookup — controls member_email match.
const userFindByIdMock = vi.fn()
vi.mock('../../packages/api/src/models/user.js', () => ({
  User: {
    findById: (...args: unknown[]) => ({
      select: () => userFindByIdMock(...args),
    }),
  },
}))

// ── App + helpers ────────────────────────────────────────────────────────────

let server: Server
let baseUrl: string

const MEMBER_EMAIL = 'owner@example.com'
const API_KEY = 'dsk_fake_key'

function makeValidPayload() {
  return {
    event: 'usage_report',
    timestamp: '2026-04-10T00:00:00.000Z',
    app_version: '1.0.0',
    member_email: MEMBER_EMAIL,
    device_info: {
      device_id: '550e8400-e29b-41d4-a716-446655440000',
      device_name: 'laptop',
      hostname: 'host',
    },
    system_info: {
      os_name: 'Win',
      os_version: '11',
      hostname: 'host',
      cpu_name: 'i7',
      cpu_cores: 8,
      ram_total_mb: 16000,
      ram_used_mb: 4000,
      arch: 'x64',
    },
    data: { profiles: [] },
    session_usage: {
      period: '7d',
      summary: {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheRead: 0,
        totalCacheWrite: 0,
        sessionCount: 0,
      },
      sessions: [],
    },
  }
}

function sign(body: string, ts: number) {
  return createHmac('sha256', API_KEY).update(`${ts}.${body}`).digest('hex')
}

async function postWebhook(body: string, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/api/webhook/usage-report`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-device-id': 'dev-1',
      'x-timestamp': String(Date.now()),
      'x-signature': sign(body, Date.now()),
      ...headers,
    },
    body,
  })
}

beforeAll(async () => {
  const webhookRouter = (await import('../../packages/api/src/routes/webhook.js')).default
  const app = express()
  // NOTE: we do NOT mount express.json() — webhook uses raw body (scoped in router)
  app.use('/api/webhook', webhookRouter)
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve())
  })
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('no address')
  baseUrl = `http://127.0.0.1:${addr.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  verifyMock.mockReset()
  ingestMock.mockReset()
  userFindByIdMock.mockReset()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/webhook/usage-report', () => {
  const fakeDevice = { _id: 'd1', user_id: new mongoose.Types.ObjectId() }

  it('200 + returns ingest result on happy path', async () => {
    verifyMock.mockResolvedValue({ ok: true, device: fakeDevice })
    userFindByIdMock.mockResolvedValue({ email: MEMBER_EMAIL })
    ingestMock.mockResolvedValue({ accepted_sessions: 0, device_updated: true })

    const res = await postWebhook(JSON.stringify(makeValidPayload()))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.accepted_sessions).toBe(0)
    expect(ingestMock).toHaveBeenCalledOnce()
  })

  it('401 when verify fails (bad HMAC / revoked / unknown device)', async () => {
    verifyMock.mockResolvedValue({ ok: false, status: 401, error: 'revoked' })
    const res = await postWebhook(JSON.stringify(makeValidPayload()))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('revoked')
    expect(ingestMock).not.toHaveBeenCalled()
  })

  it('400 when body is not valid JSON', async () => {
    verifyMock.mockResolvedValue({ ok: true, device: fakeDevice })
    const res = await postWebhook('{not valid json')
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/json/i)
    expect(ingestMock).not.toHaveBeenCalled()
  })

  it('400 when payload fails zod schema (missing event)', async () => {
    verifyMock.mockResolvedValue({ ok: true, device: fakeDevice })
    const bad = { ...makeValidPayload() }
    delete (bad as { event?: string }).event
    const res = await postWebhook(JSON.stringify(bad))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/schema/i)
    expect(ingestMock).not.toHaveBeenCalled()
  })

  it('401 when member_email does not match device owner', async () => {
    verifyMock.mockResolvedValue({ ok: true, device: fakeDevice })
    userFindByIdMock.mockResolvedValue({ email: 'other@example.com' })
    const res = await postWebhook(JSON.stringify(makeValidPayload()))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toMatch(/member_email/i)
    expect(ingestMock).not.toHaveBeenCalled()
  })

  it('401 when device owner user no longer exists', async () => {
    verifyMock.mockResolvedValue({ ok: true, device: fakeDevice })
    userFindByIdMock.mockResolvedValue(null)
    const res = await postWebhook(JSON.stringify(makeValidPayload()))
    expect(res.status).toBe(401)
  })

  it('500 when ingest throws', async () => {
    verifyMock.mockResolvedValue({ ok: true, device: fakeDevice })
    userFindByIdMock.mockResolvedValue({ email: MEMBER_EMAIL })
    ingestMock.mockRejectedValue(new Error('db down'))
    // suppress noisy error log for this case
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await postWebhook(JSON.stringify(makeValidPayload()))
    expect(res.status).toBe(500)
    errSpy.mockRestore()
  })

  it('uses raw body bytes for verify (JSON re-stringify would break signature)', async () => {
    verifyMock.mockResolvedValue({ ok: true, device: fakeDevice })
    userFindByIdMock.mockResolvedValue({ email: MEMBER_EMAIL })
    ingestMock.mockResolvedValue({ accepted_sessions: 0, device_updated: true })

    // Custom-formatted JSON with extra whitespace — a JSON parser would normalize,
    // but verify must receive the ORIGINAL string.
    const raw = '{ "event" : "usage_report" , ' + JSON.stringify(makeValidPayload()).slice(1)
    await postWebhook(raw)
    const [verifyArgs] = verifyMock.mock.calls
    expect(verifyArgs[0].rawBody).toBe(raw)
  })
})
