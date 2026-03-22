# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Internal dashboard for managing Claude AI team accounts at inet.vn. Tracks 5 Claude Teams seats shared among 13 people (7 Dev + 6 MKT). Features: seat management, usage logging (weekly percentage-based), scheduling (morning/afternoon slots), alerts (high usage, inactivity), and Telegram notifications.

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server with --watch (auto-restart)
pnpm start            # Start production server
pnpm run db:reset     # Drop and recreate MongoDB database with seed data
```

## Architecture

**Stack:** Express 5 + Mongoose (MongoDB) + Firebase Auth (Google sign-in) + vanilla JS frontend. CommonJS modules throughout.

**Backend** (`server/`):
- `index.js` — Express app entry, async startup (connectDb → initializeDb → listen), cron jobs (Telegram reminders Friday 15:00 & 17:00 Asia/Saigon)
- `config.js` — env config via dotenv (includes `mongoUri`)
- `db/database.js` — Mongoose connect/disconnect helpers
- `db/migrations.js` — Async seed data function (runs on startup via `initializeDb()`)
- `models/` — 6 Mongoose models: seat, user, usage-log, schedule, alert, team
- `middleware/auth-middleware.js` — JWT auth from cookie or Bearer header; `authenticate`, `requireAdmin`, `validateObjectId`
- `lib/firebase-admin-init.js` — Firebase Admin SDK init from service account JSON
- `routes/` — REST API routes: auth, dashboard, seats, schedules, alerts, admin, teams, usage-log (all async handlers)
- `services/` — Business logic: alert-service, telegram-service, usage-sync-service (all async)
- `scripts/db-reset.js` — Drop database + re-seed script

**Frontend** (`public/`):
- `login.html` — Firebase Google sign-in page
- `index.html` — SPA shell, loads views dynamically
- `views/` — HTML partials loaded into SPA (dashboard, seats, teams, schedule, alerts, log-usage, admin, modal)
- `js/` — Client-side JS: api-client (fetch wrapper), dashboard-app (SPA router), dashboard-helpers, admin-actions

**Database collections:** seats, users, usage_logs, schedules, alerts, teams

## Auth Flow

1. Client signs in with Google via Firebase client SDK → gets `idToken`
2. POST `/api/auth/google` with `idToken` → server verifies via Firebase Admin → issues JWT cookie (24h)
3. Subsequent requests authenticated via `authenticate` middleware (reads cookie or Bearer token)
4. Admin actions gated by `requireAdmin` middleware

## Environment Variables

See `.env.example`. Required: `JWT_SECRET`, `FIREBASE_SERVICE_ACCOUNT_PATH`, `MONGO_URI`. Optional: `PORT`, `TELEGRAM_BOT_TOKEN/CHAT_ID/TOPIC_ID`, `APP_URL`.
