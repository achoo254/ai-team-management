/**
 * BLD Digest Routes
 * GET /api/bld/digest/current.pdf  — admin-only, regenerate + stream
 * GET /api/bld/digest/download/:token — public signed link, stream PDF
 */

import { Router, type Request, type Response } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { authenticate, requireAdmin } from '../middleware.js'
import { generateWeeklyDigest, getDigestDir } from '../services/bld-pdf-service.js'
import { signDigestLink, verifyDigestLink } from '../services/bld-digest-signer.js'
import { config } from '../config.js'

const router = Router()

/** Build a full public download URL for a signed token */
function buildDownloadUrl(token: string): string {
  return `${config.webUrl.replace(/\/$/, '')}/api/bld/digest/download/${encodeURIComponent(token)}`
}

export { buildDownloadUrl }

/** Stream a PDF file to the response */
function streamPdf(res: Response, filePath: string, filename: string): void {
  const stat = fs.statSync(filePath)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('Content-Length', stat.size)
  fs.createReadStream(filePath).pipe(res)
}

/**
 * GET /current.pdf
 * Admin-only: regenerate digest on demand and stream the PDF.
 */
router.get('/current.pdf', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const filePath = await generateWeeklyDigest()
    const filename = path.basename(filePath)
    streamPdf(res, filePath, filename)
  } catch (err) {
    console.error('[BLD Digest] current.pdf generation failed:', err)
    res.status(500).json({ error: 'PDF generation failed' })
  }
})

/**
 * GET /download/:token
 * Public: verify HMAC-signed token, stream the PDF.
 * Token carries a validated basename; full path is reconstructed server-side
 * from the digest dir, preventing path traversal.
 */
router.get('/download/:token', (req: Request, res: Response) => {
  const token = req.params.token
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'Missing token' })
    return
  }

  const { basename, valid } = verifyDigestLink(token)
  if (!valid) {
    res.status(403).json({ error: 'Invalid or expired download link' })
    return
  }

  // Reconstruct path from trusted digest dir + validated basename
  const digestDir = getDigestDir()
  const filePath = path.resolve(digestDir, basename)

  // Defence-in-depth: ensure resolved path stays inside digest dir
  if (!filePath.startsWith(digestDir + path.sep) && filePath !== digestDir) {
    res.status(403).json({ error: 'Invalid path' })
    return
  }

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Digest file not found' })
    return
  }

  try {
    streamPdf(res, filePath, basename)
  } catch (err) {
    console.error('[BLD Digest] download stream failed:', err)
    res.status(500).json({ error: 'Failed to stream PDF' })
  }
})

export default router
