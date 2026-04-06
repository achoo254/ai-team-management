<p align="center">
  <img src="packages/web/public/logo.svg" alt="Claude Teams Manager" width="120" height="120" />
</p>

<h1 align="center">Claude Teams Manager</h1>

<p align="center">
  <strong>Internal dashboard for managing Claude Teams accounts — seats, activity tracking, usage monitoring & alerts.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white" alt="Express 5" />
  <img src="https://img.shields.io/badge/TypeScript-ESM-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose_9-47A248?logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/Firebase-Auth_+_FCM-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
</p>

> [Phiên bản tiếng Việt (README.md)](./README.md)

---

## Overview

Claude Teams Manager is a full-stack internal tool that centralizes the management of Claude Teams subscriptions. It provides real-time usage monitoring, automated seat activity tracking, per-user alerting, and multi-channel notifications — all behind Google SSO with role-based access.

### Key Features

- **Seat Management** — Create, assign, and track Claude Teams seats with per-owner encrypted OAuth credentials (AES-256-GCM)
- **Seat Activity Tracking** — Real-time weekly activity heatmap, auto-detects active seats via 5-minute usage snapshots with delta intensity visualization
- **Usage Monitoring** — Automated 5-minute usage snapshots, trend charts, day-over-day delta KPIs, and activity heatmaps
- **Smart Alerts** — Per-user configurable thresholds for rate limits, extra credits, and token failures with 24h dedup
- **Push Notifications** — Firebase Cloud Messaging (web push) + in-app notification feed
- **Telegram Integration** — Personal hourly reminders (encrypted per-user bots) + weekly team summary (system bot)
- **Admin Dashboard** — Team-wide analytics, session metrics, and administrative controls

---

## Tech Stack

### Frontend

| Technology | Purpose |
|:---|:---|
| **React 19** | UI framework with latest concurrent features |
| **React Router v7** | Client-side routing (SPA) |
| **TanStack React Query** | Server state management & caching |
| **Tailwind CSS v4** | Utility-first styling via `@tailwindcss/vite` |
| **shadcn/ui** (Radix UI) | Accessible, composable UI components |
| **Recharts 3** | Data visualization & charts |
| **Lucide** | Icon library |
| **Vite** | Build tool with HMR & API proxy |

### Backend

| Technology | Purpose |
|:---|:---|
| **Express 5** | HTTP framework (async error handling) |
| **TypeScript (ESM)** | Type-safe codebase, ES modules throughout |
| **MongoDB + Mongoose 9** | Document database with schema validation |
| **node-cron** | Scheduled jobs (usage collection, notifications, token refresh) |
| **tsx** | Dev server with watch mode & env file support |

### Security & Auth

| Technology | Purpose |
|:---|:---|
| **Firebase Admin SDK** | Google ID token verification |
| **JWT (httpOnly cookie)** | Stateless session tokens (24h expiry) |
| **AES-256-GCM** | At-rest encryption for OAuth credentials & Telegram tokens |
| **Role-based access** | Admin / Seat Owner / Member permission model |
| **Firebase Cloud Messaging** | Encrypted web push notifications |

### Infrastructure

| Technology | Purpose |
|:---|:---|
| **pnpm workspaces** | Monorepo with 3 packages (api, web, shared) |
| **ESM everywhere** | Consistent module system across all packages |
| **Vitest** | Unit & integration testing |
| **ESLint 9** | Code quality & consistency |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    pnpm monorepo                    │
├──────────────┬──────────────────┬───────────────────┤
│  packages/   │  packages/       │  packages/        │
│  web         │  api             │  shared           │
│              │                  │                   │
│  React 19    │  Express 5       │  TypeScript types │
│  Vite        │  MongoDB         │  Permission logic │
│  Tailwind v4 │  Firebase Admin  │                   │
│  shadcn/ui   │  node-cron       │                   │
│              │  AES-256-GCM     │                   │
└──────┬───────┴────────┬─────────┴───────────────────┘
       │    /api proxy  │
       └────────────────┘
              │
    ┌─────────┴─────────┐
    │     MongoDB       │
    │  7 collections    │
    └───────────────────┘
```

### Auth Flow

1. User signs in with Google via Firebase client SDK
2. `POST /api/auth/google` verifies token via Firebase Admin → auto-provisions user → issues JWT cookie
3. All subsequent requests authenticated via httpOnly cookie or Bearer token
4. Admin actions gated by middleware; seat-scoped actions gated by ownership checks

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9+
- MongoDB (local or Atlas)
- Firebase project with service account

### Setup

```bash
# Install dependencies
pnpm install

# Configure environment
cp packages/api/.env.example packages/api/.env.local
cp packages/web/.env.example packages/web/.env.local
# Edit .env.local files with your credentials

# Start development
pnpm dev
```

| Service | URL |
|:---|:---|
| Frontend | http://localhost:5173 |
| API | http://localhost:8386 |

### Commands

```bash
pnpm dev              # Start web + api in parallel
pnpm build            # Production build
pnpm build:staging    # Staging build
pnpm lint             # ESLint
pnpm test             # Run tests
pnpm test:coverage    # Tests with coverage
```

---

## Project Structure

```
ai-team-management/
├── packages/
│   ├── api/              # Express 5 backend
│   │   ├── src/
│   │   │   ├── models/   # 7 Mongoose models
│   │   │   ├── routes/   # 8+ REST endpoints
│   │   │   ├── services/ # Business logic
│   │   │   └── lib/      # Encryption utilities
│   │   └── .env.example
│   ├── web/              # React 19 SPA
│   │   ├── src/
│   │   │   ├── pages/    # 8 page components
│   │   │   ├── components/  # Feature + shadcn/ui
│   │   │   ├── hooks/    # 10+ React Query hooks
│   │   │   └── lib/      # API client, Firebase, utils
│   │   └── .env.example
│   └── shared/           # Shared types & permission logic
├── docs/                 # Technical documentation
└── plans/                # Implementation plans
```

---

## Documentation

- [Codebase Summary](./docs/codebase-summary.md) — Technical overview
- [Code Standards](./docs/code-standards.md) — Conventions & patterns
- [System Architecture](./docs/system-architecture.md) — Infrastructure & data flow
- [Project Overview](./docs/project-overview-pdr.md) — Features & requirements

---

## License

[MIT](./LICENSE)
