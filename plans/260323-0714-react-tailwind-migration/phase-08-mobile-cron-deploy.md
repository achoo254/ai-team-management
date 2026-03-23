# Phase 8: Mobile Polish, Cron & Deploy

## Overview
- **Priority:** P2
- **Status:** Pending
- **Effort:** 1.5 days
- **Description:** Final responsive testing, cron job solution, cleanup old code, deploy.

## Key Insights
- Cron jobs: 2 Friday Telegram notifications — need separate solution outside Next.js
- Old Express + Alpine code needs cleanup after migration verified
- Vietnamese IME tested on text inputs (names, emails)
- Deploy target TBD: Vercel, Docker, or PM2 on VPS

## Requirements

### Functional
- All 7 views pass responsive testing at 375px, 768px, 1024px, 1440px
- Cron jobs run on schedule (Friday 15:00, 17:00 Asia/Ho_Chi_Minh)
- Old code removed (server/, public/js, public/views, public/*.html)
- Production build works

### Non-functional
- Lighthouse mobile score ≥ 90
- No horizontal scroll at any breakpoint
- Touch targets ≥ 44px on mobile
- Vietnamese IME works in all text inputs

## Implementation Steps

### 1. Mobile Polish (0.5 day)

**Responsive audit checklist:**

| View | 375px | 768px | 1024px | 1440px |
|------|-------|-------|--------|--------|
| Login | | | | |
| Dashboard | | | | |
| Seats | | | | |
| Schedule | | | | |
| Log Usage | | | | |
| Alerts | | | | |
| Teams | | | | |
| Admin | | | | |

**Common fixes:**
- Text truncation with `truncate` class on long emails/names
- Table horizontal scroll wrapper: `overflow-x-auto`
- Modal/dialog: `max-h-[80vh] overflow-y-auto` on mobile
- Bottom nav: safe area inset for notched phones `pb-safe`
- Touch targets: min `h-11 w-11` (44px)

**Vietnamese IME testing:**
- Test text inputs: user name, seat label, team name, email
- If issues: use `onCompositionStart/End` handlers to defer updates
- Number inputs (usage %): no IME concern

### 2. Cron Job Solution (0.5 day)

**Option A: Separate cron worker** (Recommended for VPS deploy)
```
scripts/cron-worker.ts
├── Import telegram-service, mongoose connection
├── node-cron schedule:
│   ├── '0 15 * * 5' → sendLogReminder()
│   └── '0 17 * * 5' → sendWeeklyReport()
├── Run as separate process: `node scripts/cron-worker.js`
└── PM2 or systemd manages lifecycle
```

**Option B: Vercel Cron** (If deploying to Vercel)
```
vercel.json:
{
  "crons": [
    { "path": "/api/cron/reminder", "schedule": "0 8 * * 5" },
    { "path": "/api/cron/report", "schedule": "0 10 * * 5" }
  ]
}
// Note: Vercel cron uses UTC, adjust from Asia/Ho_Chi_Minh
// 15:00 ICT = 08:00 UTC, 17:00 ICT = 10:00 UTC

app/api/cron/reminder/route.ts:
  - Verify CRON_SECRET header
  - Call sendLogReminder()

app/api/cron/report/route.ts:
  - Verify CRON_SECRET header
  - Call sendWeeklyReport()
```

**Option C: GitHub Actions** (Free, external)
```yaml
# .github/workflows/cron-telegram.yml
on:
  schedule:
    - cron: '0 8 * * 5'   # Friday 15:00 ICT
    - cron: '0 10 * * 5'  # Friday 17:00 ICT
jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - run: curl -X POST ${{ secrets.APP_URL }}/api/cron/reminder
```

### 3. Cleanup Old Code (0.25 day)

**Files to remove:**
- `server/` — entire directory
- `public/js/` — all client JS
- `public/views/` — all HTML partials
- `public/index.html`
- `public/login.html`
- `public/css/` (if exists)

**Files to keep:**
- `public/` — only static assets (favicon, images if any)
- `.env` → `.env.local` (already migrated)
- `package.json` — update scripts

**Update package.json scripts:**
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:reset": "tsx scripts/db-reset.ts",
    "cron": "tsx scripts/cron-worker.ts"
  }
}
```

### 4. Deploy (0.25 day)

**Pre-deploy checklist:**
- [ ] `pnpm build` passes without errors
- [ ] All env vars set in production
- [ ] MongoDB connection string points to production DB
- [ ] Firebase service account configured
- [ ] Telegram bot token set

**Deploy options:**

| Option | Pros | Cons |
|--------|------|------|
| VPS + PM2 | Full control, cron built-in | Manual setup |
| Vercel | Zero config, auto SSL | Serverless cold starts, cron limits |
| Docker | Portable, consistent | More config |

**Recommended: VPS + PM2** (matches current setup, supports cron worker)
```bash
pm2 start ecosystem.config.js
# Runs: next start (port 3000) + cron-worker
```

## Todo List

- [ ] Responsive audit all 8 pages at 4 breakpoints
- [ ] Fix any mobile layout issues found
- [ ] Test Vietnamese IME in all text inputs
- [ ] Implement cron job solution (worker script or Vercel cron)
- [ ] Remove old Express + Alpine code
- [ ] Update package.json scripts
- [ ] Run `pnpm build` — verify production build
- [ ] Deploy to production
- [ ] Verify all features in production
- [ ] Monitor for 24h post-deploy

## Success Criteria
- All 7 views responsive at all breakpoints
- Lighthouse mobile ≥ 90
- Vietnamese IME works correctly
- Cron jobs fire on schedule
- Zero regression vs old version
- Old code fully removed

## Risk Assessment
- **Production cutover**: Deploy during low-traffic hours. Keep old version accessible as rollback.
- **Cron timezone**: Double-check UTC↔ICT conversion
- **MongoDB connection in production**: Ensure connection string, IP whitelist if Atlas

## Security Considerations
- Cron endpoints: verify secret header to prevent external triggers
- Remove any dev secrets from production env
- Ensure httpOnly cookie settings correct in production
- CSP headers for Firebase SDK domains
