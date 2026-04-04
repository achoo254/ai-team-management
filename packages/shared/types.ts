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
  team: 'dev' | 'mkt'
  max_users: number
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
  team?: 'dev' | 'mkt'
  seat_id?: string | null
  active: boolean
  created_at: string
}

export interface Schedule {
  _id: string
  seat_id: string
  user_id: string
  day_of_week: number
  slot: 'morning' | 'afternoon'
  created_at: string
}

export type AlertType = 'rate_limit' | 'extra_credit' | 'token_failure'

export interface AlertMetadata {
  window?: '5h' | '7d' | '7d_sonnet' | '7d_opus'
  pct?: number
  credits_used?: number
  credits_limit?: number
  error?: string
}

export interface Alert {
  _id: string
  seat_id: string
  type: AlertType
  message: string
  metadata?: AlertMetadata
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

export interface AlertSettings {
  rate_limit_pct: number
  extra_credit_pct: number
}

export interface AppSettings {
  _id?: string
  alerts: AlertSettings
}

export interface Team {
  _id: string
  name: string
  label: string
  color: string
  created_at: string
}

export interface UsageLog {
  _id: string
  seat_id: string
  week_start: string
  weekly_all_pct: number
  user_id: string
  logged_at: string
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

export interface UsageLogPopulated extends Omit<UsageLog, 'user_id'> {
  user_id: User
}

// API response wrapper
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

// Auth
export interface AuthUser {
  _id: string
  name: string
  email: string
  role: 'admin' | 'user'
  team?: 'dev' | 'mkt'
}
