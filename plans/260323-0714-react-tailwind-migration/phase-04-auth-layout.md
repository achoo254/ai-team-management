# Phase 4: Auth Flow & Layout

## Overview
- **Priority:** P1
- **Status:** Pending
- **Effort:** 2 days
- **Description:** Login page với Firebase Google OAuth, auth context/provider, responsive layout (sidebar + mobile nav)

## Key Insights
- Current login: Firebase client SDK → Google popup → POST idToken → JWT cookie
- Layout: sidebar nav (desktop) needs to become responsive drawer/bottom-nav on mobile
- 7 nav items, admin-only items hidden for regular users
- shadcn/ui `Sheet` component = perfect for mobile drawer

## Requirements

### Functional
- Google sign-in via Firebase → JWT cookie (same flow)
- Auth context provider: user state, loading, logout
- Protected route wrapper (redirect to /login if no auth)
- Responsive sidebar: collapsible on desktop, drawer on mobile
- Bottom navigation bar on mobile
- User avatar + dropdown in header

### Non-functional
- Auth check < 200ms (cached user state)
- Smooth sidebar animation
- Mobile nav thumb-reachable (bottom position)

## Related Code Files

### Files to Create
- `app/login/page.tsx` — Login page
- `app/layout.tsx` — Root layout with providers
- `app/(dashboard)/layout.tsx` — Dashboard layout (sidebar + nav)
- `components/providers/query-provider.tsx` — TanStack Query provider
- `components/providers/auth-provider.tsx` — Auth context
- `components/layout/app-sidebar.tsx` — Desktop sidebar
- `components/layout/mobile-nav.tsx` — Mobile bottom nav
- `components/layout/header.tsx` — Top header bar
- `components/layout/user-menu.tsx` — Avatar + dropdown
- `hooks/use-auth.ts` — Auth hook (useContext wrapper)

## Architecture

```
app/
├── layout.tsx                  # <html>, fonts, QueryProvider
├── login/
│   └── page.tsx                # Public — Firebase Google sign-in
└── (dashboard)/                # Route group — protected
    ├── layout.tsx              # Sidebar + Header + MobileNav
    ├── page.tsx                # Dashboard (/)
    ├── seats/page.tsx
    ├── schedule/page.tsx
    ├── log-usage/page.tsx
    ├── alerts/page.tsx
    ├── teams/page.tsx
    └── admin/page.tsx
```

### Auth Flow
```
1. User visits /login
2. Click "Sign in with Google" → Firebase popup
3. Get idToken from Firebase
4. POST /api/auth/google { idToken }
5. Server verifies → returns JWT cookie (httpOnly, 24h)
6. Redirect to /
7. AuthProvider checks /api/auth/me on mount
8. If 401 → redirect to /login
```

### Responsive Layout
```
Desktop (lg+):
┌──────────┬──────────────────────────────┐
│ Sidebar  │ Header (user menu)           │
│          ├──────────────────────────────┤
│ nav items│                              │
│          │     Page Content              │
│          │                              │
└──────────┴──────────────────────────────┘

Mobile (<lg):
┌──────────────────────────────┐
│ Header (hamburger + title)   │
├──────────────────────────────┤
│                              │
│     Page Content              │
│                              │
├──────────────────────────────┤
│ ● Home │ 📅 Sched │ 📊 Log │ ≡ More │
└──────────────────────────────┘
```

## Implementation Steps

1. **Create auth provider** `components/providers/auth-provider.tsx`
   - Context: `{ user, loading, logout }`
   - On mount: GET /api/auth/me
   - On 401: set user = null
   - `logout()`: POST /api/auth/logout → redirect /login

2. **Create query provider** `components/providers/query-provider.tsx`
   - TanStack QueryClientProvider with default options
   - staleTime: 30s, retry: 1

3. **Update root layout** `app/layout.tsx`
   - Inter font, metadata, QueryProvider wrapping

4. **Create login page** `app/login/page.tsx`
   - Firebase initializeApp with client config
   - GoogleAuthProvider + signInWithPopup
   - POST idToken to /api/auth/google
   - On success: redirect to /
   - If already logged in: redirect to /
   - Clean, centered card design with Google button

5. **Create dashboard layout** `app/(dashboard)/layout.tsx`
   - AuthProvider wrapper
   - Redirect to /login if not authenticated
   - Sidebar (desktop) + Header + MobileNav (mobile)

6. **Create app-sidebar** `components/layout/app-sidebar.tsx`
   - shadcn/ui Sidebar component
   - Nav items: Dashboard, Seats, Schedule, Log Usage, Teams, Alerts, Admin
   - Admin items gated by `user.role === 'admin'`
   - Active state from pathname
   - Icons: use lucide-react

7. **Create mobile-nav** `components/layout/mobile-nav.tsx`
   - Fixed bottom bar, 4 items + "More" sheet
   - Primary: Dashboard, Schedule, Log Usage, More
   - "More" sheet: Seats, Teams, Alerts, Admin
   - Active indicator on current route

8. **Create header** `components/layout/header.tsx`
   - Mobile: hamburger + page title
   - Desktop: breadcrumb + user menu
   - User menu: avatar, name, role badge, logout button

9. **Create use-auth hook** `hooks/use-auth.ts`
   - Simple useContext wrapper for AuthContext

## Todo List

- [ ] Create auth-provider.tsx with user state management
- [ ] Create query-provider.tsx with TanStack Query setup
- [ ] Update root layout with providers + fonts
- [ ] Create login page with Firebase Google sign-in
- [ ] Create (dashboard) route group with protected layout
- [ ] Create app-sidebar with nav items + admin gating
- [ ] Create mobile-nav bottom bar with "More" sheet
- [ ] Create header with user menu
- [ ] Create use-auth hook
- [ ] Test: login → dashboard → logout flow
- [ ] Test: mobile responsive layout transitions

## Success Criteria
- Login flow works end-to-end (Google → JWT → dashboard)
- Sidebar shows/hides based on viewport
- Mobile bottom nav appears < lg breakpoint
- Admin nav items hidden for non-admin users
- Logout clears session and redirects

## Risk Assessment
- **Firebase popup blocked**: Add fallback to redirect sign-in
- **JWT cookie not sent**: Ensure `credentials: 'include'` or same-origin
- **Hydration mismatch**: Auth state may differ server/client — use loading state

## Next Steps
→ Phase 5: Dashboard & charts (can parallel with Phase 6, 7)
