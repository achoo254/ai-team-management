---
status: pending
created: 2026-03-22
brainstorm: plans/reports/brainstorm-260322-2151-firebase-google-auth.md
---

# Firebase Google Authentication

Replace email/password login with Firebase Google Sign-In.

## Context
- Internal team app: 13 users, Express.js 5 + SQLite + JWT + Alpine.js
- Firebase Admin SDK JSON in `server/`, `firebase` v12.11.0 installed
- Google provider enabled, Web App created on Firebase Console

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Backend: Firebase Admin SDK + Google auth endpoint | pending | [phase-01](phase-01-backend-firebase-auth.md) |
| 2 | Frontend: Google Sign-In button + remove old form | pending | [phase-02](phase-02-frontend-google-signin.md) |

## Dependencies
- Phase 2 depends on Phase 1 (needs backend endpoint ready)

## Key Decisions
- Only Google Sign-In (remove email/password)
- Email match strategy: Google email must exist in users table
- Keep JWT cookie flow unchanged
