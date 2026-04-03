// Shared API types used by both @repo/web and @repo/api

export interface Seat {
  _id: string
  email: string
  label: string
  team: 'dev' | 'mkt'
  max_users: number
  has_token?: boolean
  token_active?: boolean
  last_fetched_at?: string | null
  last_fetch_error?: string | null
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

export interface Alert {
  _id: string
  seat_id: string
  type: 'high_usage' | 'no_activity'
  message: string
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
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
