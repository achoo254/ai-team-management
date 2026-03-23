# Phase 1: Project Setup & Foundation

## Overview
- **Priority:** P1 (Critical path — blocks all other phases)
- **Status:** Pending
- **Effort:** 2 days
- **Description:** Init Next.js 15 project, configure TypeScript, Tailwind v4, shadcn/ui, install all dependencies

## Key Insights
- Current project uses `public/` for frontend, `server/` for backend — new structure replaces both
- Tailwind v4 uses CSS-first config (no tailwind.config.js), uses `@theme` in CSS
- shadcn/ui v2 uses `components.json` for config, CLI for component installation
- Need to preserve `.env` vars and MongoDB connection string

## Requirements

### Functional
- Next.js 15 App Router with TypeScript strict mode
- Tailwind CSS v4 with shadcn/ui
- All existing npm packages migrated (mongoose, jsonwebtoken, firebase-admin, node-cron, cookie-parser)
- TanStack Query v5, Recharts, @dnd-kit installed

### Non-functional
- pnpm as package manager (consistent with current)
- ESLint + Prettier configured
- Path aliases (`@/` → root)

## Architecture

```
project-root/
├── app/                    # Next.js App Router
├── components/             # React components
│   └── ui/                 # shadcn/ui
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, DB, auth
├── models/                 # Mongoose models
├── services/               # Business logic
├── types/                  # TypeScript types
├── public/                 # Static assets only
├── next.config.ts
├── tailwind.config.ts      # If needed for shadcn
├── tsconfig.json
├── components.json         # shadcn/ui config
└── .env.local              # Environment variables
```

## Related Code Files

### Files to Create
- `next.config.ts` — Next.js configuration
- `tsconfig.json` — TypeScript config
- `app/layout.tsx` — Root layout (empty shell)
- `app/globals.css` — Tailwind v4 imports + theme
- `components.json` — shadcn/ui config
- `lib/utils.ts` — cn() utility for shadcn
- `types/index.ts` — Shared TypeScript types
- `.env.local` — Copy from current `.env`

### Files to Delete (after full migration)
- `public/index.html`
- `public/login.html`
- `public/js/*`
- `public/views/*`
- `server/index.js`
- `server/config.js`

## Implementation Steps

1. **Create Next.js project** in new branch `feat/nextjs-migration`
   ```bash
   pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
   ```
   NOTE: Run in a new directory or use `--no-git` to avoid conflicts

2. **Install core dependencies**
   ```bash
   pnpm add mongoose jsonwebtoken firebase-admin cookie node-cron
   pnpm add @tanstack/react-query recharts @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   pnpm add -D @types/jsonwebtoken @types/node-cron
   ```

3. **Init shadcn/ui**
   ```bash
   pnpm dlx shadcn@latest init
   ```
   Select: New York style, Zinc base color, CSS variables

4. **Install common shadcn components**
   ```bash
   pnpm dlx shadcn@latest add button card dialog dropdown-menu input label select sheet sidebar table tabs toast badge separator skeleton avatar
   ```

5. **Configure globals.css** with Tailwind v4 + Inter font + custom theme tokens
   - Primary: teal scale (match current)
   - Teams: blue (dev), green (mkt)
   - Status: red/yellow/green

6. **Setup environment variables**
   - Copy `.env` → `.env.local`
   - Add `NEXT_PUBLIC_FIREBASE_*` vars for client-side Firebase

7. **Create TypeScript types** from current Mongoose schemas
   ```typescript
   // types/index.ts
   export interface Seat { _id: string; email: string; label: string; team: 'dev' | 'mkt'; max_users: number; ... }
   export interface User { _id: string; name: string; email?: string; role: 'admin' | 'user'; team: 'dev' | 'mkt'; ... }
   // ... all 6 models
   ```

8. **Verify build** — `pnpm build` should pass with empty app

## Todo List

- [ ] Create git branch `feat/nextjs-migration`
- [ ] Init Next.js 15 with TypeScript + Tailwind
- [ ] Install all dependencies (mongoose, firebase-admin, TanStack Query, Recharts, dnd-kit)
- [ ] Init shadcn/ui + install base components
- [ ] Configure globals.css with theme tokens matching current design
- [ ] Setup .env.local with all env vars
- [ ] Create TypeScript types for all 6 models
- [ ] Create lib/utils.ts with cn() helper
- [ ] Verify `pnpm build` passes

## Success Criteria
- `pnpm dev` starts without errors
- `pnpm build` completes successfully
- shadcn/ui components render correctly
- TypeScript strict mode enabled, no type errors
- All env vars accessible

## Risk Assessment
- **Tailwind v4 + shadcn compatibility**: shadcn v2 supports Tailwind v4. Use latest CLI.
- **pnpm workspace conflicts**: If current project has workspace config, may need adjustment.

## Next Steps
→ Phase 2: Migrate models and services to TypeScript
