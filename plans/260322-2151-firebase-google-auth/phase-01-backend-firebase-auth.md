---
phase: 1
priority: high
status: pending
effort: small
---

# Phase 1: Backend — Firebase Admin SDK + Google Auth Endpoint

## Overview
Init Firebase Admin SDK and create `POST /api/auth/google` endpoint that verifies Google idToken, matches email in DB, and issues JWT cookie.

## Files to Modify
- `server/config.js` — add firebase service account path
- `server/routes/auth-routes.js` — replace login endpoint with google auth
- `.env.example` — add FIREBASE_SERVICE_ACCOUNT_PATH
- `.gitignore` — add service account JSON pattern
- `package.json` — add `firebase-admin` dependency (Admin SDK !== client `firebase`)

## Implementation Steps

### 1. Install firebase-admin
```bash
pnpm add firebase-admin
```
Note: `firebase` (client SDK) already installed but NOT needed on server. `firebase-admin` is the server-side SDK.

### 2. Update `.gitignore`
Add: `*-firebase-adminsdk-*.json`

### 3. Update `.env.example`
Add: `FIREBASE_SERVICE_ACCOUNT_PATH=server/quan-ly-team-claude-firebase-adminsdk-fbsvc-f8d10a3d02.json`

### 4. Update `server/config.js`
Add: `firebaseServiceAccountPath` from env

### 5. Create `server/lib/firebase-admin-init.js`
- Import `firebase-admin`
- Read service account JSON from config path
- Init admin app with credential
- Export `admin` instance

### 6. Update `server/routes/auth-routes.js`
- Remove `POST /login` (bcrypt login)
- Remove `bcryptjs` import
- Add `POST /google`:
  ```
  1. Get idToken from req.body
  2. admin.auth().verifyIdToken(idToken)
  3. Extract email from decoded token
  4. Find user in DB by email
  5. If not found → 401 "User not registered"
  6. Sign JWT + set cookie (same as current flow)
  7. Return user data
  ```

## Success Criteria
- [ ] `firebase-admin` installed
- [ ] Service account JSON in `.gitignore`
- [ ] `POST /api/auth/google` verifies idToken and returns JWT cookie
- [ ] Old `POST /api/auth/login` removed
- [ ] Server starts without errors
