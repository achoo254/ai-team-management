// Shared API types used by both @repo/web and @repo/api

export interface OAuthCredentialMeta {
  expires_at: string | null
  scopes: string[]
  subscription_type: string | null
  rate_limit_tier: string | null
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
  oauth_credential?: OAuthCredentialMeta | null
  last_fetched_at?: string | null
  last_fetch_error?: string | null
  last_refreshed_at?: string | null
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
  watched_seat_ids?: string[]
  notification_settings?: NotificationSettings
  alert_settings?: UserAlertSettings
  push_enabled?: boolean
  created_at: string
}

export interface Schedule {
  _id: string
  seat_id: string
  user_id: string
  day_of_week: number
  start_hour: number         // 0-23
  end_hour: number           // 0-23 (exclusive)
  usage_budget_pct?: number | null  // 1-100, null = auto-divide
  created_at: string
}

export type AlertType = 'rate_limit' | 'extra_credit' | 'token_failure' | 'usage_exceeded' | 'session_waste' | '7d_risk'

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
}

export interface Alert {
  _id: string
  seat_id: string | { _id: string; email: string; label: string }
  type: AlertType
  message: string
  metadata?: AlertMetadata
  read_by?: string[]
  created_at: string
}

export interface UserAlertSettings {
  enabled: boolean
  rate_limit_pct: number        // 1-100, default 80
  extra_credit_pct: number      // 1-100, default 80
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
export interface SchedulePopulated extends Omit<Schedule, 'seat_id' | 'user_id'> {
  seat_id: Seat
  user_id: User
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

// Schedule permissions
export interface SchedulePermissions {
  canView: boolean
  canCreate: boolean
  canCreateForOthers: boolean
  canSwap: boolean
  canClearAll: boolean
  canEditEntry: (entry: { user_id: string }) => boolean
  canDeleteEntry: (entry: { user_id: string }) => boolean
}

// Auth
export interface AuthUser {
  _id: string
  name: string
  email: string
  role: 'admin' | 'user'
}
