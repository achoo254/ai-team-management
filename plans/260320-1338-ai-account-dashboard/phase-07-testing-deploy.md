# Phase 7: Testing & Deploy

**Priority:** Medium | **Status:** pending | **Effort:** 0.5 day

## Overview
Test core flows, deploy lên VPS hoặc Cloudflare.

## Testing
- API endpoints: manual test + simple test script
- Auth flow: login/logout/role check
- Sync flow: verify data from Anthropic API
- UI: manual check all views on desktop + mobile

## Deploy Options

### Option A: VPS (recommended for simplicity)
- `pm2 start server/index.js`
- Nginx reverse proxy
- SQLite file on disk
- Let's Encrypt SSL

### Option B: Cloudflare Workers + D1
- Rewrite to Workers format
- D1 for SQLite-compatible DB
- Free tier sufficient
- More effort to migrate

**Recommend Option A** — simpler, team đã có VPS.

## Implementation Steps
- [ ] Write test script for critical API endpoints
- [ ] Test full sync flow with real Anthropic API key
- [ ] Test auth flow (admin vs user permissions)
- [ ] Setup PM2 + Nginx on VPS
- [ ] Configure SSL
- [ ] Setup daily backup for SQLite file
- [ ] Verify dashboard accessible from team

## Security Checklist
- [ ] .env not in git
- [ ] JWT secret strong (32+ chars)
- [ ] Anthropic admin key secured
- [ ] Rate limiting on login endpoint
- [ ] HTTPS only
- [ ] Password hashed with bcrypt

## Success Criteria
- Dashboard accessible via HTTPS URL
- All team members can login
- Usage data syncs daily
- Mobile responsive confirmed
