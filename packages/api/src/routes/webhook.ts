// Desktop telemetry webhook ingest endpoint (HMAC-authenticated).
// Uses raw body parser — HMAC must verify exact bytes the client signed.
import { Router, type Request, type Response, raw as expressRaw } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { usageReportSchema } from '@repo/shared/webhook-schema'
import { User } from '../models/user.js'
import { ingestUsageReport } from '../services/webhook-ingest-service.js'
import { verifyWebhookRequest } from '../services/webhook-verify-service.js'

const router = Router()

/** 120 req/min per device_id (header-based key). Falls back to IP if missing. */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.headers['x-device-id'] as string) || ipKeyGenerator(req.ip ?? ''),
  message: { error: 'Rate limit exceeded' },
})

/**
 * POST /api/webhook/usage-report
 * Auth: HMAC-SHA256 over `${X-Timestamp}.${rawBody}` keyed with device api_key.
 * Uses raw body parser (scoped) because JSON re-stringify breaks signature.
 */
router.post(
  '/usage-report',
  webhookLimiter,
  expressRaw({ type: 'application/json', limit: '512kb' }),
  async (req: Request, res: Response) => {
    const rawBody = (req.body as Buffer).toString('utf8')

    // 1. HMAC verify
    const verify = await verifyWebhookRequest({
      deviceId: req.headers['x-device-id'] as string | undefined,
      timestampHeader: req.headers['x-timestamp'] as string | undefined,
      signatureHeader: req.headers['x-signature'] as string | undefined,
      rawBody,
    })
    if (!verify.ok) {
      res.status(verify.status).json({ error: verify.error })
      return
    }
    const { device } = verify

    // 2. Parse JSON + Zod validate
    let payloadJson: unknown
    try {
      payloadJson = JSON.parse(rawBody)
    } catch {
      res.status(400).json({ error: 'Invalid JSON' })
      return
    }
    const parsed = usageReportSchema.safeParse(payloadJson)
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: 'Schema validation failed', details: parsed.error.issues.slice(0, 5) })
      return
    }
    const payload = parsed.data

    // 3. Anti-stolen-device: member_email must match the device's owning user
    const user = await User.findById(device.user_id).select('email')
    if (!user || user.email !== payload.member_email) {
      res.status(401).json({ error: 'member_email mismatch' })
      return
    }

    // 4. Ingest
    try {
      const result = await ingestUsageReport(device, device.user_id, payload)
      res.json({ ok: true, ...result })
    } catch (err) {
      console.error('[webhook ingest] failed:', err)
      res.status(500).json({ error: 'Ingest failed' })
    }
  },
)

export default router
