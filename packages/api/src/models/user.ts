import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface INotificationSettings {
  report_enabled: boolean
  report_days: number[]   // 0=Sun..6=Sat
  report_hour: number     // 0-23 in Asia/Ho_Chi_Minh
  last_report_sent_at?: Date | null
}

export interface IAlertSettings {
  enabled: boolean
  telegram_enabled: boolean
  token_failure_enabled: boolean
  // BLD digest fields (deprecated — kept for DB compat, no longer used)
  fleet_util_threshold_pct?: number | null
  fleet_util_threshold_days?: number | null
}

export interface IWatchedSeat {
  seat_id: Types.ObjectId
  threshold_5h_pct: number
  threshold_7d_pct: number
  burn_rate_threshold: number | null    // %/h, default 15 (null = disabled)
  eta_warning_hours: number | null      // hours, default 1.5 (null = disabled)
  forecast_warning_hours: number | null // hours, default 48 (null = disabled)
}

export interface IUser extends Document {
  name: string
  email?: string
  role: 'admin' | 'user'
  seat_ids?: Types.ObjectId[]
  active: boolean
  telegram_bot_token?: string | null  // encrypted via AES-256-GCM
  telegram_chat_id?: string | null
  telegram_topic_id?: string | null
  watched_seats?: IWatchedSeat[]
  notification_settings?: INotificationSettings
  alert_settings?: IAlertSettings
  dashboard_filter_seat_ids?: Types.ObjectId[]
  dashboard_default_range?: 'day' | 'week' | 'month' | '3month' | '6month'
  fcm_tokens: string[]
  push_enabled: boolean
  created_at: Date
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    seat_ids: [{ type: Schema.Types.ObjectId, ref: 'Seat' }],
    active: { type: Boolean, default: true },
    telegram_bot_token: { type: String, default: null },
    telegram_chat_id: { type: String, default: null },
    telegram_topic_id: { type: String, default: null },
    watched_seats: {
      type: [
        {
          seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', required: true },
          threshold_5h_pct: { type: Number, default: 90, min: 1, max: 100 },
          threshold_7d_pct: { type: Number, default: 85, min: 1, max: 100 },
          burn_rate_threshold: { type: Number, default: 15, min: 5 },
          eta_warning_hours: { type: Number, default: 1.5, min: 0.5 },
          forecast_warning_hours: { type: Number, default: 48, min: 6 },
        },
      ],
      default: [],
    },
    notification_settings: {
      report_enabled: { type: Boolean, default: false },
      report_days: { type: [Number], default: [5] },     // Friday
      report_hour: { type: Number, default: 9 },          // 9 AM VN
      last_report_sent_at: { type: Date, default: null },
    },
    alert_settings: {
      enabled: { type: Boolean, default: false },
      telegram_enabled: { type: Boolean, default: true },
      token_failure_enabled: { type: Boolean, default: true },
      bld_digest_enabled: { type: Boolean, default: false },
      bld_digest_days: { type: [Number], default: [5] },
      bld_digest_hour: { type: Number, default: 17 },
      fleet_util_threshold_pct: { type: Number, default: null },
      fleet_util_threshold_days: { type: Number, default: null },
    },
    dashboard_filter_seat_ids: [{ type: Schema.Types.ObjectId, ref: 'Seat' }],
    dashboard_default_range: { type: String, enum: ['day', 'week', 'month', '3month', '6month'], default: 'day' },
    fcm_tokens: { type: [String], default: [] },
    push_enabled: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Strip token from JSON output, expose has_telegram_bot boolean
userSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    const hasToken = !!ret.telegram_bot_token
    delete ret.telegram_bot_token
    delete ret.fcm_tokens
    // Strip internal state from API responses
    if (ret.notification_settings) {
      delete ret.notification_settings.last_report_sent_at
    }
    ret.has_telegram_bot = hasToken && !!ret.telegram_chat_id
    return ret
  },
})

export const User = mongoose.model<IUser>('User', userSchema)
