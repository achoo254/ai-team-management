# Phase 6: Mount Routes + Integration

## Overview
- Priority: HIGH
- Status: completed
- Depends on: Phases 4, 5

## File to Modify

### 6.1 `packages/api/src/index.ts`

Add imports:
```ts
import deviceRoutes from './routes/devices.js'
import webhookRoutes from './routes/webhook.js'
```

Mount (place AFTER existing routes, BEFORE errorHandler):
```ts
app.use('/api/devices', deviceRoutes)
app.use('/api/webhook', webhookRoutes)
```

**CRITICAL order constraint:**
- Global `app.use(express.json())` đã được set (line 31)
- Webhook route dùng `raw()` body parser scoped to endpoint → OK, Express uses first-match
- Phải verify `express.json()` KHÔNG parse body trước khi route handler nhận raw
- Solution: webhook route dùng `express.raw({ type: 'application/json' })` INSIDE route, sẽ override nếu global json chưa parse. **Risk:** global `app.use(express.json())` sẽ parse trước → raw parser nhận empty.

**Fix:** skip global json parser cho `/api/webhook/*`:
```ts
// Before: app.use(express.json())
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhook')) return next()
  return express.json()(req, res, next)
})
```

Hoặc clean hơn — mount webhook route TRƯỚC global json middleware:
```ts
app.use(cors({ origin: config.webUrl, credentials: true }))
app.use(cookieParser())

// Mount webhook BEFORE json parser so it can consume raw body
app.use('/api/webhook', webhookRoutes)

// Then standard json parser for everything else
app.use(express.json())

// Other routes ...
```

**Chọn option 2 (mount trước)** — rõ ràng hơn, không có conditional middleware.

### Final index.ts diff
```ts
// Middleware
app.use(cors({ origin: config.webUrl, credentials: true }))
app.use(cookieParser())

// Webhook FIRST — needs raw body, must bypass global json parser
app.use('/api/webhook', webhookRoutes)

// Global JSON parser for all other routes
app.use(express.json())

// Routes — all mounted under /api
app.use('/api/auth', authRoutes)
// ... existing routes unchanged ...
app.use('/api/devices', deviceRoutes)  // NEW
```

## Acceptance
- `pnpm -F @repo/api build` passes
- `pnpm dev:api` starts without error
- Curl test:
  - `POST /api/devices` with JWT → 201 with api_key
  - `POST /api/webhook/usage-report` with valid HMAC → 200
  - Existing `/api/auth`, `/api/seats`, etc. still work (json body parsing)
- No regression in existing routes

## Risks
- Re-ordering middleware có thể break if existing route depends on something between cors/json. → Check: chỉ có cookieParser + json. Cookies không ảnh hưởng webhook (stateless). Safe.

## Todo
- [x] Edit index.ts: reorder middleware, add imports, mount routes
- [x] Run `pnpm dev:api`, verify start
- [x] Smoke test existing route still parses JSON body
- [x] Typecheck pass
