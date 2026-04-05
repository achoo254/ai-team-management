import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface INotificationSettings {
  report_enabled: boolean
  report_days: number[]
  report_hour: number
}

export interface IAlertSettings {
  enabled: boolean
  rate_limit_pct: number
  extra_credit_pct: number
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
  watched_seat_ids?: Types.ObjectId[]
  notification_settings?: INotificationSettings
  alert_settings?: IAlertSettings
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
    watched_seat_ids: [{ type: Schema.Types.ObjectId, ref: 'Seat' }],
    notification_settings: {
      report_enabled: { type: Boolean, default: false },
      report_days: { type: [Number], default: [5] },
      report_hour: { type: Number, default: 8 },
    },
    alert_settings: {
      enabled: { type: Boolean, default: false },
      rate_limit_pct: { type: Number, default: 80 },
      extra_credit_pct: { type: Number, default: 80 },
    },
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
    ret.has_telegram_bot = hasToken && !!ret.telegram_chat_id
    return ret
  },
})

export const User = mongoose.model<IUser>('User', userSchema)
