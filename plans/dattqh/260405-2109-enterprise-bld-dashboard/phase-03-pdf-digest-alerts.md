# Phase 3 — PDF Digest + Alert Settings

## Context Links
- Plan: [../plan.md](../plan.md)
- Phase 2: [phase-02-bld-view-page.md](phase-02-bld-view-page.md)
- Brainstorm: `plans/dattqh/reports/brainstorm-260405-2109-enterprise-bld-dashboard.md`

## Overview
- Priority: MEDIUM
- Status: pending (blocked by P2)
- Effort: ~1-2 days

Weekly PDF digest generated Friday 17:00, delivered via Telegram system bot as download link. Extend alert settings for BLD threshold alerts.

## Key Insights
- Existing cron Friday 17:00 gửi weekly summary qua Telegram system bot → extend it
- PDF lib candidate: **pdfkit** (smaller ~800KB, simpler API) vs @react-pdf/renderer (~2MB, JSX)
- Reuse P2 metrics endpoints → DRY
- Alert settings: extend `user.alert_settings` schema hoặc new `admin_alert_settings`

## Requirements

### Functional
1. PDF generated weekly Friday 17:00, saved to disk `{DATA_DIR}/bld-digests/{iso-date}.pdf`
2. PDF content: fleet KPIs, top 3 waste seats, W/W trend table, rebalance suggestions
3. **Scope: chỉ company seats** — personal-domain seats không xuất hiện trong PDF (tái dùng `isCompanySeat` từ bld-metrics-service)
3. Telegram message gửi link download (token-auth, expire 7d)
4. On-demand PDF endpoint: `GET /api/bld/digest/current.pdf` (admin-only)
5. Alert settings: "Notify if fleet util <X% for Y days" config per admin

### Non-functional
- PDF generation <5s
- PDF file size <500KB
- Retention: auto-delete PDFs older than 30d

## Architecture

```
cron (Friday 17:00)
  └─ existing weekly-summary-job
       ├─ existing Telegram summary text
       └─ NEW: bldPdfService.generateWeeklyDigest()
            ├─ fetch KPIs from bld-metrics-service
            ├─ render PDF via pdfkit
            ├─ save to DATA_DIR/bld-digests/{date}.pdf
            └─ send Telegram message with signed link

packages/api/src/services/bld-pdf-service.ts (new)
  ├─ generateWeeklyDigest(): Promise<string> (returns file path)
  ├─ signDigestLink(filePath, ttl=7d): string
  └─ purgeExpiredDigests(): void (called by cleanup cron)

packages/api/src/routes/bld-digest.ts (new)
  ├─ GET /api/bld/digest/current.pdf (on-demand, admin)
  └─ GET /api/bld/digest/download/:token (signed link, public with auth)
```

## Related Code Files

### Modify
- `packages/api/src/index.ts` — mount bld-digest router + extend cron
- `packages/api/src/services/telegram-service.ts` — add sendBldDigest method
- `packages/api/src/models/user.ts` — extend alert_settings schema (fleet_util_alert config)
- `packages/web/src/pages/settings.tsx` — admin alert settings UI
- `packages/shared/types.ts` — BldAlertSettings DTO

### Create
- `packages/api/src/services/bld-pdf-service.ts`
- `packages/api/src/routes/bld-digest.ts`
- `packages/web/src/components/bld-alert-settings-form.tsx`
- `tests/api/bld-pdf-service.test.ts`

## Implementation Steps

### Dependency
1. `pnpm -F @repo/api add pdfkit @types/pdfkit`

### Backend

2. **PDF service `bld-pdf-service.ts`**
   ```ts
   import PDFDocument from 'pdfkit'
   import fs from 'node:fs'
   import path from 'node:path'
   import crypto from 'node:crypto'

   const DIGEST_DIR = path.join(config.DATA_DIR, 'bld-digests')
   const LINK_SECRET = config.DIGEST_LINK_SECRET

   export async function generateWeeklyDigest(): Promise<string> {
     const kpis = await computeFleetKpis()
     const suggestions = await computeRebalanceSuggestions()
     const doc = new PDFDocument({ size: 'A4', margin: 50 })
     const date = new Date().toISOString().split('T')[0]
     const filePath = path.join(DIGEST_DIR, `${date}.pdf`)
     fs.mkdirSync(DIGEST_DIR, { recursive: true })
     doc.pipe(fs.createWriteStream(filePath))

     // Header
     doc.fontSize(20).text('BLD Weekly Digest', { align: 'center' })
     doc.fontSize(10).text(`Generated: ${new Date().toLocaleString('vi-VN')}`)

     // KPI section
     doc.fontSize(14).text('Fleet KPIs')
     doc.fontSize(10)
       .text(`Fleet Utilization: ${kpis.utilPct.toFixed(1)}%`)
       .text(`Waste: $${kpis.wasteUsd.toFixed(2)}/month`)
       .text(`W/W Delta: ${kpis.wwDelta > 0 ? '+' : ''}${kpis.wwDelta.toFixed(1)}%`)
       .text(`Billable seats: ${kpis.billableCount} × $${kpis.monthlyCostUsd} = $${kpis.totalCostUsd}/month`)

     // Suggestions (member rebalance, NOT seat cuts — Teams min 5 seats)
     doc.addPage().fontSize(14).text('Đề xuất tối ưu')
     suggestions.forEach(s => {
       if (s.type === 'move_user') doc.fontSize(10).text(`- Di chuyển user từ seat ${s.fromSeat} sang ${s.toSeat}: ${s.reason}`)
       else if (s.type === 'reassign_user') doc.fontSize(10).text(`- Phân công lại user ${s.userId}: ${s.reason}`)
       else if (s.type === 'add_seat') doc.fontSize(10).text(`- Đề xuất THÊM seat: ${s.reason} (+$${kpis.monthlyCostUsd}/month)`)
     })

     doc.end()
     await new Promise(r => doc.on('end', r))
     return filePath
   }

   export function signDigestLink(filePath: string, ttlSec = 604800): string {
     const payload = `${filePath}:${Date.now() + ttlSec * 1000}`
     const sig = crypto.createHmac('sha256', LINK_SECRET).update(payload).digest('hex')
     return Buffer.from(`${payload}:${sig}`).toString('base64url')
   }
   ```

3. **Route `bld-digest.ts`**
   - `GET /current.pdf` → regenerate + stream (admin only)
   - `GET /download/:token` → verify signed token, stream PDF

4. **Extend cron** (`packages/api/src/index.ts`)
   - After existing weekly summary send: call `generateWeeklyDigest()` + `sendBldDigest()` to Telegram

5. **Telegram service**
   - `sendBldDigest(link: string)` — sends formatted message with signed link

6. **Config**
   - Add `DATA_DIR`, `DIGEST_LINK_SECRET`, `BLD_DIGEST_TELEGRAM_TOPIC_ID` to env

### Frontend

7. **Alert settings form** (`bld-alert-settings-form.tsx`)
   - Toggle: "Weekly BLD digest to Telegram"
   - Number: "Alert if fleet util <X% for Y days"
   - Mount in settings page admin section

8. **User model extension**
   - `user.alert_settings.bld_digest_enabled: boolean`
   - `user.alert_settings.fleet_util_threshold_pct: number | null`
   - `user.alert_settings.fleet_util_threshold_days: number | null`

### Cleanup

9. **Cleanup cron** — daily purge PDFs older than 30d

### Tests

10. `tests/api/bld-pdf-service.test.ts`
    - signDigestLink roundtrip
    - Generated PDF is valid (size > 0, starts with `%PDF-`)
    - purgeExpiredDigests removes old files only

## Todo List

- [ ] Install pdfkit + @types/pdfkit
- [ ] Add DATA_DIR, DIGEST_LINK_SECRET to env + config
- [ ] Create bld-pdf-service.ts (generate + sign)
- [ ] Create bld-digest routes (current.pdf, download/:token)
- [ ] Extend Friday 17:00 cron
- [ ] Telegram service: sendBldDigest
- [ ] Extend user.alert_settings schema
- [ ] Create bld-alert-settings-form component
- [ ] Mount form in settings page (admin-only)
- [ ] Daily cleanup cron (purge >30d)
- [ ] Tests: bld-pdf-service
- [ ] Typecheck + full test suite
- [ ] Smoke test: manual trigger PDF endpoint, download, verify contents

## Success Criteria
- PDF generates <5s, file size <500KB
- Telegram message arrives Friday 17:00 with working link
- Signed link denies access after expiry
- Admin can toggle BLD digest in settings
- Alert fires when fleet util below threshold for N days
- Old PDFs auto-purged

## Risks
- pdfkit Vietnamese font support — may need custom font file embed
- Telegram message size limit — keep message short, link only
- Disk space — 4 PDFs/month × 500KB × 30d retention = ~60KB, safe
- Token leak → link gives PDF access only, short TTL, HMAC verified

## Security
- Signed link uses HMAC-SHA256, server-side secret
- Admin-only for on-demand endpoint
- PDF content has cost/waste data → treat as confidential
- Token rotation: regenerate `DIGEST_LINK_SECRET` periodically (ops task)

## Next Steps
- → Archive plan when all 3 phases completed
- → User testing with BLD for feedback
- → Iterate on PDF layout based on feedback
