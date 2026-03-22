# Phase 1: Project Setup

**Priority:** High | **Status:** pending | **Effort:** 0.5 day

## Overview
Khởi tạo project structure, dependencies, config cơ bản.

## Requirements
- Node.js project với Express backend
- TailwindCSS via CDN (no build step)
- SQLite database file
- Environment variables cho Anthropic Admin API key

## Project Structure
```
quan-ly-team-claude/
├── server/
│   ├── index.js                # Express entry point
│   ├── config.js               # Environment config
│   ├── db/
│   │   ├── database.js         # SQLite connection
│   │   └── migrations.js       # Schema setup
│   ├── routes/
│   │   ├── auth-routes.js      # Login/logout
│   │   ├── dashboard-routes.js # Dashboard API
│   │   ├── seat-routes.js      # Seat management
│   │   └── schedule-routes.js  # Slot scheduling
│   ├── services/
│   │   ├── anthropic-service.js # Anthropic API client
│   │   ├── usage-sync-service.js# Cron sync logic
│   │   └── alert-service.js    # Alert logic
│   └── middleware/
│       └── auth-middleware.js   # Auth check
├── public/
│   ├── index.html              # Dashboard SPA
│   ├── login.html              # Login page
│   ├── css/
│   │   └── app.css             # Custom styles
│   └── js/
│       ├── dashboard.js        # Dashboard logic
│       ├── seats.js            # Seat management UI
│       ├── schedule.js         # Scheduling UI
│       └── api-client.js       # API helper
├── .env                        # Secrets (gitignored)
├── .env.example                # Template
├── package.json
└── README.md
```

## Implementation Steps
- [ ] `npm init` + install dependencies: express, better-sqlite3, node-cron, bcrypt, jsonwebtoken, dotenv
- [ ] Create `.env.example` with: `ANTHROPIC_ADMIN_KEY`, `JWT_SECRET`, `PORT`
- [ ] Create `server/index.js` — Express server with static files + API routes
- [ ] Create `server/config.js` — centralized config from env
- [ ] Verify server starts on `http://localhost:3000`

## Success Criteria
- `npm start` runs without errors
- Server serves static files from `public/`
- `.env` loaded correctly
