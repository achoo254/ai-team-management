---
phase: 2
priority: high
status: pending
effort: small
depends_on: [1]
---

# Phase 2: Frontend — Google Sign-In Button

## Overview
Replace email/password form in `login.html` with "Sign in with Google" button using Firebase Client SDK.

## Files to Modify
- `public/login.html` — replace form with Google button + Firebase client init

## Implementation Steps

### 1. Add Firebase Client SDK (CDN)
Add Firebase compat scripts to `<head>`:
```html
<script src="https://www.gstatic.com/firebasejs/11.9.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/11.9.0/firebase-auth-compat.js"></script>
```

### 2. Replace login form
Remove email/password form. Add:
- Google Sign-In button with Google logo SVG
- Loading state handling
- Error display

### 3. Firebase init + sign-in logic
```javascript
const firebaseConfig = { /* from Firebase Console */ };
firebase.initializeApp(firebaseConfig);

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const result = await firebase.auth().signInWithPopup(provider);
  const idToken = await result.user.getIdToken();

  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken })
  });

  if (res.ok) window.location.href = '/';
  else showError('User not registered');
}
```

### 4. Firebase config
User needs to provide firebaseConfig from Firebase Console → Project Settings → Your apps → Web app.
Values needed: apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId

## Success Criteria
- [ ] Google Sign-In button visible on login page
- [ ] Clicking triggers Google popup
- [ ] Successful login redirects to dashboard
- [ ] Non-registered email shows error
- [ ] No email/password form remains
