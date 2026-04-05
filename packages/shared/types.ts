// Shared API types used by both @repo/web and @repo/api

export interface OAuthCredentialMeta {
  expires_at: string | null
  scopes: string[]
  subscription_type: string | null
  rate_limit_tier: string | null
}

export interface SeatProfile {
  account_name: string | null
  display_name: string | null
  org_name: string | null
  org_type: string | null
  billing_type: string | null
  rate_limit_tier: string | null
  subscription_status: string | null
  has_claude_max: boolean
  has_claude_pro: boolean
  fetched_at: string | null  // ISO string on wire
}

export interface RestorableSeat {
  _id: string
  label: string
  deleted_at: string
  has_history: boolean  // true if usage_snapshots exist
}

export interface Seat {
  _id: string
  email: string
  label: string
  max_users: number
  owner_id: string | null
  owner?: { _id: string; name: string; email: string } | null
  has_token?: boolean
  token_active?: boolean
  /** When true, seat appears in admin overview / BLD metrics tab. */
  include_in_overview?: boolean
  oauth_credential?: OAuthCredentialMeta | null
  last_fetched_at?: string | null
  last_fetch_error?: string | null
  last_refreshed_at?: string | null
  profile?: SeatProfile | null
  created_at: string
}

export interface User {
  _id: string
  name: string
  email?: string
  role: 'admin' | 'user'
  seat_id?: string | null
  active: boolean
  telegram_chat_id?: string | null
  telegram_topic_id?: string | null
  has_telegram_bot?: boolean
  watched_seats?: WatchedSeat[]
  notification_settings?: NotificationSettings
  alert_settings?: UserAlertSettings
  push_enabled?: boolean
  created_at: string
}

export interface Schedule {
  _id: string
  seat_id: string
  day_of_week: number
  start_hour: number         // 0-23
  end_hour: number           // 0-23 (exclusive)
  source: 'auto' | 'legacy'
  created_at: string
}

export interface SeatActivityLog {
  _id: string
  seat_id: string
  date: string               // ISO date string (start of day VN time)
  hour: number               // 0-23
  is_active: boolean
  delta_5h_pct: number
  snapshot_count: number
  created_at: string
}

export interface HeatmapCell {
  day_of_week: number
  hour: number
  activity_rate: number      // 0-1 (percentage of weeks active)
  avg_delta: number
  max_delta: number
}

export interface RealtimeStatus {
  seat_id: string
  seat_label: string
  is_active: boolean
  current_delta: number
  last_snapshot_at: string | null
}

export type AlertType = 'rate_limit' | 'token_failure' | 'usage_exceeded' | 'session_waste' | '7d_risk' | 'unexpected_activity' | 'unexpected_idle'
export type AlertWindow = '5h' | '7d' | null

export interface AlertMetadata {
  session?: '5h' | '7d' | '7d_sonnet' | '7d_opus'
  pct?: number
  credits_used?: number
  credits_limit?: number
  error?: string
  delta?: number
  budget?: number
  user_id?: string
  user_name?: string
  current_7d?: number
  projected?: number
  remaining_sessions?: number
  duration?: number
  resets_at?: string
  next_user?: boolean
  max_pct?: number
  breakdown?: { seven_day_pct?: number | null; seven_day_sonnet_pct?: number | null; seven_day_opus_pct?: number | null }
  threshold?: number
}

export interface Alert {
  _id: string
  user_id?: string | null
  seat_id: string | { _id: string; email: string; label: string }
  type: AlertType
  window?: AlertWindow
  message: string
  metadata?: AlertMetadata
  read_by?: string[]
  created_at: string
}

export interface UserAlertSettings {
  enabled: boolean
  telegram_enabled: boolean       // send via Telegram channel
  token_failure_enabled: boolean  // receive token invalid/failure alerts, default true
  // BLD-specific settings (admin only, ignored for regular users)
  bld_digest_enabled?: boolean
  bld_digest_days?: number[]   // 0=Sun..6=Sat, default [5]
  bld_digest_hour?: number     // 0-23, Asia/Ho_Chi_Minh, default 17
  fleet_util_threshold_pct?: number | null
  fleet_util_threshold_days?: number | null
}

export interface WatchedSeat {
  seat_id: string
  threshold_5h_pct: number
  threshold_7d_pct: number
  seat_label?: string
  seat_email?: string
}

export interface UsageSnapshot {
  _id: string
  seat_id: string
  raw_response?: Record<string, unknown>
  five_hour_pct: number | null
  five_hour_resets_at: string | null
  seven_day_pct: number | null
  seven_day_resets_at: string | null
  seven_day_sonnet_pct: number | null
  seven_day_sonnet_resets_at: string | null
  seven_day_opus_pct: number | null
  seven_day_opus_resets_at: string | null
  extra_usage: {
    is_enabled: boolean
    monthly_limit: number | null
    used_credits: number | null
    utilization: number | null
  }
  fetched_at: string
}

// Populated variants
export interface SchedulePopulated extends Omit<Schedule, 'seat_id'> {
  seat_id: Seat
}

// API response wrapper
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Notification settings
export interface NotificationSettings {
  report_enabled: boolean
  report_days: number[]      // 0=Sun, 1=Mon, ..., 6=Sat
  report_hour: number        // 0-23
}

// Schedule permissions (simplified: auto-detected activity, read-only for most users)
export interface SchedulePermissions {
  canView: boolean
  canManage: boolean  // admin only: force regenerate patterns, etc.
}

// Quota forecast (7d linear regression)
export type QuotaForecastStatus =
  | 'safe' | 'watch' | 'warning' | 'critical' | 'imminent'
  | 'safe_decreasing' | 'collecting' | 'reset_first'

export interface QuotaForecastResult {
  seat_id: string
  seat_label: string
  current_pct: number
  slope_per_hour: number
  hours_to_full: number | null
  forecast_at: string | null
  status: QuotaForecastStatus
  resets_at: string | null
}

export interface QuotaForecast {
  seven_day: QuotaForecastResult | null
  seven_day_seats: QuotaForecastResult[]
  five_hour: {
    current_pct: number
    status: 'safe' | 'warning' | 'critical'
    resets_at: string | null
  } | null
}

// Auth
export interface AuthUser {
  _id: string
  name: string
  email: string
  role: 'admin' | 'user'
}

// Dashboard data quality DTOs (Phase 1)

export interface StaleSeatInfo {
  seat_id: string
  label: string
  hours_since_fetch: number
}

export interface TokenFailureInfo {
  seat_id: string
  label: string
  /** Sanitized error message (no tokens/paths/keys) */
  error_message: string
  last_fetched_at: string | null
}

export interface UrgentForecastItem {
  seat_id: string
  seat_label: string
  current_pct: number
  hours_to_full: number | null
  forecast_at: string | null
  status: QuotaForecastStatus
}

// ── BLD (Executive Dashboard) DTOs ───────────────────────────────────────────

export interface BldWorstForecast {
  seat_id: string
  seat_label: string
  hours_to_full: number | null
  forecast_at: string | null
  status: QuotaForecastStatus
}

export interface FleetKpis {
  utilPct: number
  wasteUsd: number
  totalCostUsd: number
  monthlyCostUsd: number
  billableCount: number
  wwDelta: number
  /** Day-over-day delta: avg peak 5h today minus avg peak 5h yesterday (pp) */
  ddDelta: number | null
  worstForecast: BldWorstForecast | null
}

export interface WwHistoryPoint {
  week_start: string
  utilPct: number
  wasteUsd: number
}

export interface DdHistoryPoint {
  date: string       // ISO date string
  avgPeak5h: number  // fleet avg of per-seat max five_hour_pct that day
}

export interface FleetKpisResponse {
  kpis: FleetKpis
  wwHistory: WwHistoryPoint[]
  ddHistory: DdHistoryPoint[]
}

// ── Seat-level stats DTOs ─────────────────────────────────────────────────────

export interface SeatWasteEntry {
  seatId: string
  seatLabel: string
  utilPct: number
  wasteUsd: number
  wastePct: number
}

export interface BurndownSeat {
  seatId: string
  seatLabel: string
  consecutiveDays: number
  latestUtilPct: number
}

export interface DegradationSeat {
  seatId: string
  seatLabel: string
  currentUtilPct: number
  lastWeekUtilPct: number
  dropPp: number
}

export interface SeatStatsResponse {
  topWaste: SeatWasteEntry[]
  burndownRisk: BurndownSeat[]
  degradationWatch: DegradationSeat[]
}

// ── Rebalance suggestions ─────────────────────────────────────────────────────

export type RebalanceSuggestion =
  | {
      type: 'move_member'
      fromSeatId: string
      fromSeatLabel: string
      toSeatId: string
      toSeatLabel: string
      reason: string
    }
  | {
      type: 'add_seat'
      reason: string
      estimatedMonthlyCost: number
    }
  | {
      type: 'rebalance_seat'
      overloadedSeatId: string
      overloadedSeatLabel: string
      underusedSeatId: string
      underusedSeatLabel: string
      reason: string
    }
