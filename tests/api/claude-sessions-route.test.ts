// Route-level tests for /api/claude-sessions — mocks query service + middleware,
// asserts param parsing, permission pass-through, and response shape.
import express from '../../packages/api/node_modules/express/index.js'
import type { Server } from 'http'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'

// ── Mocks ────────────────────────────────────────────────────────────────────

let fakeUser: { _id: string; email: string; name: string; role: 'admin' | 'user' } = {
  _id: new mongoose.Types.ObjectId().toString(),
  email: 'u@example.com',
  name: 'U',
  role: 'user',
}
vi.mock('../../packages/api/src/middleware.js', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    ;(req as unknown as { user: typeof fakeUser }).user = fakeUser
    next()
  },
  // Re-export unused stubs so any transitive import stays safe
  getAllowedSeatIds: vi.fn(),
}))

const listClaudeSessionsMock = vi.fn()
vi.mock('../../packages/api/src/services/claude-sessions-query-service.js', () => ({
  listClaudeSessions: (...args: unknown[]) => listClaudeSessionsMock(...args),
}))

// ── App ──────────────────────────────────────────────────────────────────────

let server: Server
let baseUrl: string

beforeAll(async () => {
  const router = (await import('../../packages/api/src/routes/claude-sessions.js')).default
  const app = express()
  app.use(express.json())
  app.use('/api/claude-sessions', router)
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
  listClaudeSessionsMock.mockReset()
  listClaudeSessionsMock.mockResolvedValue({ sessions: [], total: 0 })
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/claude-sessions', () => {
  it('200 with empty defaults, passes user through', async () => {
    const res = await fetch(`${baseUrl}/api/claude-sessions`)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ sessions: [], total: 0 })
    const [userArg, filtersArg] = listClaudeSessionsMock.mock.calls[0]
    expect(userArg).toMatchObject({ role: 'user' })
    expect(filtersArg).toEqual({
      seat_id: undefined,
      profile_email: undefined,
      since: undefined,
      until: undefined,
      limit: undefined,
    })
  })

  it('parses all query params', async () => {
    const seatId = new mongoose.Types.ObjectId().toString()
    const since = '2026-04-01T00:00:00.000Z'
    const until = '2026-04-10T00:00:00.000Z'
    const res = await fetch(
      `${baseUrl}/api/claude-sessions?seat_id=${seatId}&profile_email=p@x.com&since=${since}&until=${until}&limit=50`,
    )
    expect(res.status).toBe(200)
    const [, filtersArg] = listClaudeSessionsMock.mock.calls[0]
    expect(filtersArg.seat_id).toBe(seatId)
    expect(filtersArg.profile_email).toBe('p@x.com')
    expect((filtersArg.since as Date).toISOString()).toBe(since)
    expect((filtersArg.until as Date).toISOString()).toBe(until)
    expect(filtersArg.limit).toBe(50)
  })

  it('400 on invalid since', async () => {
    const res = await fetch(`${baseUrl}/api/claude-sessions?since=not-a-date`)
    expect(res.status).toBe(400)
    expect(listClaudeSessionsMock).not.toHaveBeenCalled()
  })

  it('400 on invalid limit', async () => {
    const res = await fetch(`${baseUrl}/api/claude-sessions?limit=abc`)
    expect(res.status).toBe(400)
  })

  it('returns sessions payload from service', async () => {
    listClaudeSessionsMock.mockResolvedValue({
      sessions: [{ session_id: 's1' }, { session_id: 's2' }],
      total: 2,
    })
    const res = await fetch(`${baseUrl}/api/claude-sessions`)
    const json = await res.json()
    expect(json.total).toBe(2)
    expect(json.sessions).toHaveLength(2)
  })

  it('propagates admin role to service', async () => {
    fakeUser = { ...fakeUser, role: 'admin' }
    const res = await fetch(`${baseUrl}/api/claude-sessions`)
    expect(res.status).toBe(200)
    const [userArg] = listClaudeSessionsMock.mock.calls[0]
    expect(userArg.role).toBe('admin')
    fakeUser = { ...fakeUser, role: 'user' } // reset
  })
})
