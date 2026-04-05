# Alert Rate Limit System Architecture

## Current Design: Per-User, Global Thresholds

### 1. User Alert Settings Schema
**File**: `packages/api/src/models/user.ts` (lines 9-14)

```typescript
interface IAlertSettings {
  enabled: boolean
  rate_limit_pct: number        // 80% default
  extra_credit_pct: number      // 80% default
  token_failure_enabled: boolean
}
```

**Location**: Stored on User document, not per-seat. Controls when alerts fire for all watched seats.

---

### 2. Seat Model
**File**: `packages/api/src/models/seat.ts` (lines 12-24)

No usage thresholds on Seat itself. Contains:
- `max_users: number`
- `rate_limit_tier?: string` (in oauth_credential, informational only)
- `token_active: boolean`
- `last_fetch_error?: string`

**Missing**: Per-seat usage limits, threshold overrides, or rate limit caps.

---

### 3. Alert Service Logic
**File**: `packages/api/src/services/alert-service.ts` (lines 84-198)

Key function: `checkSnapshotAlerts()` runs periodically:

1. **Threshold aggregation** (lines 112-123): Finds lowest `rate_limit_pct` + `extra_credit_pct` across all users watching a seat → used as the trigger threshold for that seat
2. **Per-window usage checking** (lines 140-162):
   - Compares `snapshot.five_hour_pct`, `seven_day_pct`, `seven_day_sonnet_pct`, `seven_day_opus_pct` against lowest threshold
   - **Alert created once per 24h** (de-duplication in `insertIfNew()` at lines 26-35)
3. **Per-user filtering** (lines 47-81): `notifySubscribedUsers()` filters eligible users by their thresholds before sending Telegram/FCM
4. **Extra credit** (lines 164-173): Similar logic for `snapshot.extra_usage.utilization`

**Per-seat? No** — thresholds are user-level; alert deduplication is per-seat+type.

---

### 4. Usage Collector
**File**: `packages/api/src/services/usage-collector-service.ts` (lines 22-90)

Fetches from Anthropic OAuth API (`/api/oauth/usage`) and stores `UsageSnapshot`:

**Snapshot contents** (lines 47-68):
- `five_hour_pct`, `five_hour_resets_at`
- `seven_day_pct`, `seven_day_resets_at`
- `seven_day_sonnet_pct`, `seven_day_sonnet_resets_at`
- `seven_day_opus_pct`, `seven_day_opus_resets_at`
- `extra_usage: { is_enabled, monthly_limit, used_credits, utilization }`
- `raw_response` (full API response)

**Per-seat? Yes** — one snapshot per seat, indexed by `seat_id + fetched_at`.

---

### 5. API Surface & UI
**Routes**:
- `GET /api/user/settings` (lines 12-48 user-settings.ts): Returns `alert_settings`, `watched_seat_ids`, `available_seats`
- `PUT /api/user/settings` (lines 51-146): Accepts `alert_settings { enabled, rate_limit_pct, extra_credit_pct, token_failure_enabled }`
- No per-seat alert settings endpoint

**UI** (`alert-settings-form.tsx`, lines 10-15):
- Global toggles: Enable, Token failure warning
- Global sliders: `rate_limit_pct`, `extra_credit_pct` (1-100%)
- Desktop push & Telegram bot config

---

### 6. Session Metrics Model
**File**: `packages/api/src/models/session-metric.ts` (lines 3-34)

Recorded per session with 5h + 7d windows:
```typescript
{
  seat_id, user_id, schedule_id, date, start_hour, end_hour, duration_hours,
  delta_5h_pct, delta_7d_pct, delta_7d_sonnet_pct, delta_7d_opus_pct,
  impact_ratio, utilization_pct, reset_count_5h,
  snapshot_start: { five_hour_pct, seven_day_pct, seven_day_sonnet_pct, seven_day_opus_pct },
  snapshot_end: { same fields }
}
```

**Per-seat? Yes** — indexed on `seat_id + date`.

---

## Architecture Summary

| Aspect | Current | Per-User | Per-Seat |
|--------|---------|----------|----------|
| **Thresholds** | User `alert_settings` | ✅ Global | ❌ No override |
| **Usage data** | `UsageSnapshot` | ❌ | ✅ (5h, 7d windows) |
| **Alert dedup** | Alert record | ❌ | ✅ (24h per type) |
| **Session tracking** | `SessionMetric` | ❌ | ✅ (per session) |

---

## Refactor Considerations

**What exists to support per-seat 5h/7d thresholds:**
- ✅ `UsageSnapshot` captures all 4 windows per seat hourly
- ✅ `SessionMetric` tracks per-seat + per-user deltas across windows
- ✅ Alert service already filters subscribers by threshold

**What's missing for per-seat thresholds:**
- ❌ No seat-level `usage_limits` or `alert_thresholds` field
- ❌ No per-seat override API/UI
- ❌ Alert service uses lowest user threshold per seat, not seat-level cap
- ❌ No per-window (5h vs 7d) granularity in user settings

---

## Unresolved Questions

1. **Seat-level hard caps?** Should seats have global usage caps (e.g., 5h max 95%) separate from user alert preferences?
2. **Threshold precedence?** If seat has cap=90% and user wants 85%, should we alert at 85% or 90%?
3. **Window granularity?** Currently `rate_limit_pct` applies to all windows (5h, 7d, 7d_sonnet, 7d_opus). Should thresholds be per-window?
4. **Silent alerts?** Should per-seat caps trigger "system alerts" (to admin) separate from user alerts?
