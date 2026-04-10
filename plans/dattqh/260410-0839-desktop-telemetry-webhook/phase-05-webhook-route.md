# Phase 5: Webhook Route (HMAC)

## Overview
- Priority: HIGH
- Status: completed
- Depends on: Phase 3

## File to Create

### 5.1 `packages/api/src/routes/webhook.ts` (<180 LOC)

```ts
import { Router, type Request, type Response, raw as expressRaw } from 'express'
import rateLimit from 'express-rate-limit'
import { usageReportSchema } from '@repo/shared/webhook-schema'
import { User } from '../models/user.js'
import { verifyWebhookRequest } from '../services/webhook-verify-service.js'
import { ingestUsageReport } from '../services/webhook-ingest-service.js'

const router = Router()

/**
 * Rate limit: 120 req/min per device_id (header-based key).
 * Falls back to IP if header missing (will be rejected by verify anyway).
 */
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.headers['x-device-id'] as string) || req.ip || 'unknown',
  message: { error: 'Rate limit exceeded' },
})

/**
 * POST /api/webhook/usage-report
 * Auth: HMAC-SHA256 over `${X-Timestamp}.${rawBody}` with device api_key.
 *
 * IMPORTANT: uses raw body parser because HMAC must verify exact bytes
 * client signed (JSON re-stringify changes whitespace → signature breaks).
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
      res.status(400).json({ error: 'Schema validation failed', details: parsed.error.issues.slice(0, 5) })
      return
    }
    const payload = parsed.data

    // 3. member_email must match device owner (anti-stolen-device)
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
```

**Critical decisions:**
- **Raw body parser** — HMAC verification requires exact bytes the client signed. Must NOT use `express.json()` here. Body limit `512kb`.
- Rate limit BEFORE verify to protect lookup query.
- Error logs strip headers (default Express logger doesn't log them).
- 401 cho mọi auth fail (HMAC, timestamp, revoked, member_email mismatch) — no info leakage.
- Schema details limited to first 5 issues (avoid leaking full structure).

## Acceptance
- Typecheck pass
- File < 200 LOC
- Body raw parsing isolated (không ảnh hưởng `express.json()` global)
- 401 với HMAC sai / timestamp lệch / revoked device / member_email mismatch
- 400 với JSON sai / schema fail
- 200 + accepted_sessions count khi success

## Todo
- [x] Create routes/webhook.ts
- [x] Verify raw parser scoped to this route only
- [x] Typecheck pass
