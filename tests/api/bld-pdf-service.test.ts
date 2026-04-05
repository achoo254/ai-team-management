/**
 * Tests for bld-digest-signer.ts and bld-pdf-service.ts
 * - signDigestLink + verifyDigestLink roundtrip
 * - Expired token rejected
 * - generateWeeklyDigest produces valid PDF (size > 0, magic bytes %PDF-)
 * - purgeExpiredDigests removes only files older than 30 days
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// Ensure distinct digest secret BEFORE config module loads.
// vi.hoisted runs before any import, including hoisted imports.
vi.hoisted(() => {
  process.env.DIGEST_LINK_SECRET = process.env.DIGEST_LINK_SECRET || 'test-digest-secret-distinct-from-jwt'
})

// Top-level mocks (hoisted by vitest before any imports)
vi.mock('../../packages/api/src/services/bld-metrics-service.js', () => ({
  computeFleetKpis: vi.fn().mockResolvedValue({
    utilPct: 65.5,
    wasteUsd: 217.5,
    totalCostUsd: 625,
    monthlyCostUsd: 125,
    billableCount: 5,
    wwDelta: 2.1,
    worstForecast: null,
  }),
  computeWwHistory: vi.fn().mockResolvedValue([
    { week_start: '2026-03-29T00:00:00.000Z', utilPct: 63.4, wasteUsd: 229.5 },
    { week_start: '2026-04-05T00:00:00.000Z', utilPct: 65.5, wasteUsd: 217.5 },
  ]),
  computeRebalanceSuggestions: vi.fn().mockResolvedValue([]),
  getSeatsInScope: vi.fn().mockResolvedValue([]),
}))

vi.mock('../../packages/api/src/services/bld-pdf-data-helper.js', () => ({
  latestSnapshotsForSeats: vi.fn().mockResolvedValue([]),
}))

// Import after mocks are declared
import {
  signDigestLink,
  verifyDigestLink,
} from '../../packages/api/src/services/bld-digest-signer.js'

import {
  generateWeeklyDigest,
  purgeExpiredDigests,
} from '../../packages/api/src/services/bld-pdf-service.js'

// ── Signer tests (pure, no DB) ────────────────────────────────────────────────

describe('signDigestLink / verifyDigestLink', () => {
  it('roundtrip: signed basename verifies correctly', () => {
    const basename = '2026-04-05.pdf'
    const token = signDigestLink(basename, 3600)
    const result = verifyDigestLink(token)
    expect(result.valid).toBe(true)
    expect(result.basename).toBe(basename)
  })

  it('rejects tampered token', () => {
    const token = signDigestLink('test.pdf', 3600)
    // Flip last character to corrupt HMAC
    const corrupted = token.slice(0, -1) + (token.at(-1) === 'a' ? 'b' : 'a')
    const result = verifyDigestLink(corrupted)
    expect(result.valid).toBe(false)
  })

  it('rejects expired token (ttlSec = -1)', () => {
    const token = signDigestLink('test.pdf', -1)
    const result = verifyDigestLink(token)
    expect(result.valid).toBe(false)
  })

  it('rejects path-traversal basenames on sign', () => {
    expect(() => signDigestLink('../etc/passwd')).toThrow()
    expect(() => signDigestLink('foo/bar.pdf')).toThrow()
    expect(() => signDigestLink('foo\\bar.pdf')).toThrow()
    expect(() => signDigestLink('not-a-pdf.txt')).toThrow()
  })

  it('rejects completely invalid tokens', () => {
    expect(verifyDigestLink('not-a-token').valid).toBe(false)
    expect(verifyDigestLink('').valid).toBe(false)
    expect(verifyDigestLink('YWJj').valid).toBe(false) // base64url of "abc"
  })
})

// ── purgeExpiredDigests tests (filesystem only, no DB) ────────────────────────

describe('purgeExpiredDigests', () => {
  let digestDir: string
  let origDataDir: string | undefined

  beforeEach(() => {
    origDataDir = process.env.DATA_DIR
    // Create a temp parent dir; purgeExpiredDigests appends "bld-digests"
    const parentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bld-data-'))
    digestDir = path.join(parentDir, 'bld-digests')
    fs.mkdirSync(digestDir, { recursive: true })
    process.env.DATA_DIR = parentDir
  })

  afterEach(() => {
    if (digestDir && fs.existsSync(path.dirname(digestDir))) {
      fs.rmSync(path.dirname(digestDir), { recursive: true })
    }
    if (origDataDir === undefined) delete process.env.DATA_DIR
    else process.env.DATA_DIR = origDataDir
  })

  function createFileWithMtime(filename: string, daysAgo: number): string {
    const filePath = path.join(digestDir, filename)
    fs.writeFileSync(filePath, '%PDF-1.4 test content')
    const mtime = new Date(Date.now() - daysAgo * 24 * 3600_000)
    fs.utimesSync(filePath, mtime, mtime)
    return filePath
  }

  it('removes files older than 30 days', () => {
    const old = createFileWithMtime('2026-01-01.pdf', 35)
    const recent = createFileWithMtime('2026-04-01.pdf', 5)

    purgeExpiredDigests()

    expect(fs.existsSync(old)).toBe(false)
    expect(fs.existsSync(recent)).toBe(true)
  })

  it('keeps files that are exactly 29 days old', () => {
    const youngEnough = createFileWithMtime('2026-03-07.pdf', 29)
    purgeExpiredDigests()
    expect(fs.existsSync(youngEnough)).toBe(true)
  })

  it('does nothing when digest dir does not exist', () => {
    fs.rmSync(digestDir, { recursive: true })
    expect(() => purgeExpiredDigests()).not.toThrow()
  })
})

// ── generateWeeklyDigest integration test (mocked metrics) ───────────────────

describe('generateWeeklyDigest', () => {
  let tmpDataDir: string
  let origDataDir: string | undefined

  beforeEach(() => {
    origDataDir = process.env.DATA_DIR
    tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bld-gen-'))
    process.env.DATA_DIR = tmpDataDir
  })

  afterEach(() => {
    if (fs.existsSync(tmpDataDir)) fs.rmSync(tmpDataDir, { recursive: true })
    if (origDataDir === undefined) delete process.env.DATA_DIR
    else process.env.DATA_DIR = origDataDir
  })

  it('generates a PDF file with valid magic bytes and non-zero size', async () => {
    const filePath = await generateWeeklyDigest()

    expect(fs.existsSync(filePath)).toBe(true)

    const buf = fs.readFileSync(filePath)
    expect(buf.length).toBeGreaterThan(0)

    // PDF magic bytes: %PDF-
    const magic = buf.slice(0, 5).toString('ascii')
    expect(magic).toBe('%PDF-')
  })
})
