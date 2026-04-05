/**
 * BLD Digest Signer
 * HMAC-SHA256 token signing/verification for signed PDF download links.
 * Signs basename only — caller reconstructs full path from digest dir.
 * Kept separate from PDF generation to stay under 200-LOC limit.
 */

import crypto from 'node:crypto'
import { config } from '../config.js'

function getSecret(): string {
  const s = config.digestLinkSecret
  if (!s || s === config.jwtSecret) {
    throw new Error(
      '[BLD Digest] DIGEST_LINK_SECRET must be set and distinct from JWT_SECRET',
    )
  }
  return s
}

/**
 * Validate that name is a simple basename — no separators, no traversal.
 * Accept: letters, digits, dash, underscore, dot. Must end with .pdf.
 */
function isValidBasename(name: string): boolean {
  if (!name || name.length > 64) return false
  if (name.includes('/') || name.includes('\\') || name.includes('..')) return false
  return /^[A-Za-z0-9._-]+\.pdf$/.test(name)
}

/**
 * Signs a basename (not full path) with a TTL.
 * Token format (base64url): `{basename}:{expiresAtMs}:{hmac}`
 */
export function signDigestLink(basename: string, ttlSec = 604800): string {
  if (!isValidBasename(basename)) {
    throw new Error('[BLD Digest] Invalid basename for signing')
  }
  const expiresAt = Date.now() + ttlSec * 1000
  const payload = `${basename}:${expiresAt}`
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

/**
 * Verifies a signed token.
 * Returns { basename, valid } — valid=false if tampered, expired, or basename invalid.
 */
export function verifyDigestLink(token: string): { basename: string; valid: boolean } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const lastColon = decoded.lastIndexOf(':')
    if (lastColon < 0) return { basename: '', valid: false }
    const sig = decoded.slice(lastColon + 1)
    const withoutSig = decoded.slice(0, lastColon)

    const secondLast = withoutSig.lastIndexOf(':')
    if (secondLast < 0) return { basename: '', valid: false }
    const expiresAtStr = withoutSig.slice(secondLast + 1)
    const basename = withoutSig.slice(0, secondLast)

    if (!isValidBasename(basename)) return { basename: '', valid: false }

    // Validate HMAC
    const expected = crypto.createHmac('sha256', getSecret()).update(withoutSig).digest('hex')
    const sigBuf = Buffer.from(sig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { basename, valid: false }
    }

    // Validate expiry
    const expiresAt = parseInt(expiresAtStr, 10)
    if (!isFinite(expiresAt) || Date.now() > expiresAt) {
      return { basename, valid: false }
    }

    return { basename, valid: true }
  } catch {
    return { basename: '', valid: false }
  }
}
