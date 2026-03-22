# Brainstorm: Firebase Google Authentication

## Problem Statement
Replace email/password login with Firebase Google Sign-In for internal team management app (13 users, inet.vn).

## Current State
- Express.js 5 + SQLite + JWT (httpOnly cookie) + Alpine.js frontend
- Firebase Admin SDK JSON already in `server/`
- Firebase package v12.11.0 installed but unused
- Google provider enabled on Firebase Console, Web App created

## Decisions Made
- **Only Google Sign-In** — remove email/password form
- **Email match strategy** — Google email must match existing user email in DB
- **Keep JWT flow** — only change auth input (idToken instead of password)

## Implementation Scope

### Frontend (`public/login.html`)
1. Add Firebase Client SDK (CDN)
2. Init Firebase with config (apiKey, authDomain, projectId)
3. Replace email/password form with "Sign in with Google" button
4. `signInWithPopup()` → get idToken → POST to `/api/auth/google`

### Backend
5. Init Firebase Admin SDK using service account JSON
6. New endpoint `POST /api/auth/google` — verify idToken → find user by email → issue JWT cookie
7. Remove old `POST /api/auth/login` endpoint

### Config & Security
8. Add service account JSON path to `.env`
9. Add service account JSON to `.gitignore`
10. Firebase client config is NOT secret — safe in frontend

## Flow
```
Browser → Google popup (Firebase Client SDK)
Browser ← idToken from Google
Browser → POST /api/auth/google {idToken}
Server → Firebase Admin SDK verifyIdToken(idToken)
Server → SQLite: find user by email
Server → Issue JWT cookie (same as current flow)
Browser ← Login success + redirect
```

## Risks
- Service account JSON must NOT be committed to git
- Users not in DB will be rejected (by design)
- Google popup may be blocked by browser — handle gracefully

## Next Steps
Create implementation plan and code immediately.
