# Brainstorm: Alert System Redesign (UsageSnapshot-based)

**Date:** 2026-04-04
**Status:** Approved by user

## Problem Statement

Current alert system only uses **manual UsageLog** (user self-reports weekly %). With real-time **UsageSnapshot** data collected every 30 min from Anthropic API, alert system is outdated and underutilizes available data.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Alert types | 3 new: rate_limit, extra_credit, token_failure | Covers all UsageSnapshot data dimensions |
| Legacy alerts | **Delete all**, remove code | Clean break, no migration complexity |
| Check frequency | Every 30 min (same cron as collection) | Real-time alerting, dedup prevents spam |
| Config source | **Admin UI settings** | Admin can tune thresholds without deploy |
| Telegram | **Send on every new alert** | Immediate visibility, dedup prevents spam |

## Final Design

### 1. New Alert Types

| Type | Trigger | Data Source | Message Example |
|------|---------|------------|-----------------|
| `rate_limit` | 5h_pct OR 7d_pct >= threshold | UsageSnapshot | "Seat X: 85% usage (7d window, ngưỡng: 80%)" |
| `extra_credit` | extra_usage.utilization >= threshold | UsageSnapshot | "Seat X: extra credits 92% used ($46/$50)" |
| `token_failure` | seat.last_fetch_error exists | Seat model | "Seat X: token lỗi — invalid_grant" |

### 2. Model Changes

**Alert model** — update `type` enum:
```
type: 'rate_limit' | 'extra_credit' | 'token_failure'
```

Add `metadata` field (optional, for context display):
```ts
metadata?: {
  window?: '5h' | '7d' | '7d_sonnet' | '7d_opus'  // which rate limit window
  pct?: number                                       // usage percentage
  credits_used?: number
  credits_limit?: number
  error?: string                                     // token error message
}
```

**New: Settings model** — app-wide config stored in DB:
```ts
// Single document, upserted
{
  alerts: {
    rate_limit_pct: number       // default 80
    extra_credit_pct: number     // default 80
  }
}
```

### 3. Deduplication Strategy

**Change from:** 1 alert/day/seat/type
**Change to:** No new alert if **unresolved** alert exists for same seat+type

Rationale: With 30-min checks, daily dedup creates new alert each day for ongoing issues. Unresolved-based dedup means one alert per incident until admin resolves it.

### 4. Alert Check Flow

```
Cron */30 → collectAllUsage()
         → checkSnapshotAlerts()
              ├─ Load settings from DB (cached)
              ├─ Get latest snapshot per seat (last 1h)
              ├─ For each seat:
              │   ├─ Check rate_limit: any window >= settings.rate_limit_pct
              │   ├─ Check extra_credit: utilization >= settings.extra_credit_pct
              │   └─ Check token_failure: seat.last_fetch_error != null
              ├─ insertIfNew() for each triggered rule
              └─ Send Telegram for each NEW alert created
```

### 5. Backend Changes

| File | Change |
|------|--------|
| `models/alert.ts` | Update type enum, add metadata field |
| `models/setting.ts` | **New** — Settings model (single doc) |
| `services/alert-service.ts` | Rewrite: UsageSnapshot-based rules, new dedup logic |
| `services/telegram-service.ts` | Add alert notification function |
| `routes/alerts.ts` | No change (CRUD already works) |
| `routes/settings.ts` | **New** — GET/PUT /api/settings (admin only) |
| `config.ts` | Keep defaults as fallback, settings DB overrides |
| `index.ts` | Chain checkSnapshotAlerts() after collectAllUsage() |
| `shared/types.ts` | Update Alert type, add Settings type |

### 6. Frontend Changes

| File | Change |
|------|--------|
| `components/alert-card.tsx` | New badges/icons for 3 types, metadata display |
| `pages/alerts.tsx` | Update filter options if needed |
| `pages/admin.tsx` | Add alert settings section (thresholds) |
| `hooks/use-admin.ts` | Add useSettings, useUpdateSettings hooks |
| `hooks/use-alerts.ts` | No change needed |

### 7. DB Migration

- Run script: `db.alerts.deleteMany({})` — drop all old alerts
- No schema migration needed (Mongoose handles new fields)

### 8. Telegram Alert Format

```
🔴 Alert: Rate Limit Warning
Seat: marketing-01
Window: 7-day | Usage: 85%
Ngưỡng: 80%
```

```
💳 Alert: Extra Credit Warning  
Seat: dev-02
Credits: $46/$50 (92%)
Ngưỡng: 80%
```

```
⚠️ Alert: Token Failure
Seat: dev-03
Error: invalid_grant
→ Cần re-import token
```

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Spam alerts mỗi 30 phút | Unresolved-based dedup — chỉ 1 alert/incident |
| Settings model single point of failure | Fallback to config.ts defaults |
| Token failure alert khi seat bị disable | Chỉ check seats có `token_active: true` |
| Extra credit alert cho seat không enable | Chỉ check khi `extra_usage.is_enabled: true` |

## Scope Estimate

- **Backend:** ~4-5 files modified/created
- **Frontend:** ~4 files modified
- **Complexity:** Medium — mostly service logic rewrite + new Settings CRUD
- **No breaking API changes** — alert CRUD endpoints unchanged

## Next Steps

1. Create implementation plan with phased approach
2. Phase 1: Settings model + API
3. Phase 2: Alert service rewrite
4. Phase 3: Telegram integration
5. Phase 4: Frontend updates
6. Phase 5: DB cleanup + testing
