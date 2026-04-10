// Route-level tests for /api/devices — mocks service + middleware, spins up
// a minimal Express app and drives requests via global fetch.
// express is only available inside the api package; resolve through its node_modules
import express from '../../packages/api/node_modules/express/index.js'
import type { Server } from 'http'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'

// ── Mocks ────────────────────────────────────────────────────────────────────

// Fake authenticate middleware — injects a fixed user.
const fakeUserId = new mongoose.Types.ObjectId().toString()
vi.mock('../../packages/api/src/middleware.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ;(req as unknown as { user: { _id: string; email: string } }).user = {
      _id: fakeUserId,
      email: 'u@example.com',
    }
    next()
  },
}))

// Mock device-service — capture calls, return stub data.
const createDeviceMock = vi.fn()
const listDevicesForUserMock = vi.fn()
const revokeDeviceMock = vi.fn()
vi.mock('../../packages/api/src/services/device-service.js', () => ({
  createDevice: (...args: unknown[]) => createDeviceMock(...args),
  listDevicesForUser: (...args: unknown[]) => listDevicesForUserMock(...args),
  revokeDevice: (...args: unknown[]) => revokeDeviceMock(...args),
}))

// ── App ──────────────────────────────────────────────────────────────────────

let server: Server
let baseUrl: string

beforeAll(async () => {
  const devicesRouter = (await import('../../packages/api/src/routes/devices.js')).default
  const app = express()
  app.use(express.json())
  app.use('/api/devices', devicesRouter)
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
  createDeviceMock.mockReset()
  listDevicesForUserMock.mockReset()
  revokeDeviceMock.mockReset()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/devices', () => {
  it('201 + returns plaintext api_key on valid body', async () => {
    createDeviceMock.mockResolvedValue({
      device: { toJSON: () => ({ _id: 'd1', device_name: 'laptop' }) },
      plaintext_api_key: 'dsk_plaintext',
    })

    const res = await fetch(`${baseUrl}/api/devices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_name: 'laptop', hostname: 'host' }),
    })
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.api_key).toBe('dsk_plaintext')
    expect(json.device).toMatchObject({ _id: 'd1', device_name: 'laptop' })
    expect(createDeviceMock).toHaveBeenCalledOnce()
  })

  it('400 when device_name is empty', async () => {
    const res = await fetch(`${baseUrl}/api/devices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_name: '   ', hostname: 'host' }),
    })
    expect(res.status).toBe(400)
    expect(createDeviceMock).not.toHaveBeenCalled()
  })

  it('400 when hostname is missing', async () => {
    const res = await fetch(`${baseUrl}/api/devices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_name: 'laptop' }),
    })
    expect(res.status).toBe(400)
  })

  it('400 when fields exceed 200 chars', async () => {
    const res = await fetch(`${baseUrl}/api/devices`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ device_name: 'x'.repeat(201), hostname: 'host' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/devices', () => {
  it('returns devices for authenticated user only', async () => {
    listDevicesForUserMock.mockResolvedValue([{ _id: 'd1' }, { _id: 'd2' }])
    const res = await fetch(`${baseUrl}/api/devices`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.devices).toHaveLength(2)
    // Service was called with current user id
    const [userArg] = listDevicesForUserMock.mock.calls[0]
    expect(String(userArg)).toBe(fakeUserId)
  })
})

describe('DELETE /api/devices/:id', () => {
  it('200 when device found + revoked', async () => {
    const id = new mongoose.Types.ObjectId().toString()
    revokeDeviceMock.mockResolvedValue({ _id: id, revoked_at: new Date() })
    const res = await fetch(`${baseUrl}/api/devices/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
  })

  it('400 on invalid ObjectId', async () => {
    const res = await fetch(`${baseUrl}/api/devices/not-an-id`, { method: 'DELETE' })
    expect(res.status).toBe(400)
    expect(revokeDeviceMock).not.toHaveBeenCalled()
  })

  it('404 when service returns null (already revoked / not owned)', async () => {
    const id = new mongoose.Types.ObjectId().toString()
    revokeDeviceMock.mockResolvedValue(null)
    const res = await fetch(`${baseUrl}/api/devices/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(404)
  })
})
