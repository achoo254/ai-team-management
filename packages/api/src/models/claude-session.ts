import mongoose, { Schema, type Types } from 'mongoose'

// NOTE: we intentionally don't extend mongoose.Document because the domain has
// a `model` field (Claude model name) which collides with Document.model()
// method signature. Mongoose's HydratedDocument handles this at model<T>() call.
export interface IClaudeSession {
  session_id: string
  device_id: Types.ObjectId
  user_id: Types.ObjectId
  seat_id: Types.ObjectId | null
  profile_email: string
  subscription_type: string | null
  rate_limit_tier: string | null
  model: string
  started_at: Date
  ended_at: Date
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read: number
  total_cache_write: number
  message_count: number
  usage_five_hour_pct: number | null
  usage_seven_day_pct: number | null
  usage_seven_day_sonnet_pct: number | null
  received_at: Date
}

const claudeSessionSchema = new Schema<IClaudeSession>({
  session_id: { type: String, required: true, unique: true },
  device_id: { type: Schema.Types.ObjectId, ref: 'Device', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  seat_id: { type: Schema.Types.ObjectId, ref: 'Seat', default: null },
  profile_email: { type: String, required: true },
  subscription_type: { type: String, default: null },
  rate_limit_tier: { type: String, default: null },
  model: { type: String, required: true },
  started_at: { type: Date, required: true },
  ended_at: { type: Date, required: true },
  total_input_tokens: { type: Number, default: 0 },
  total_output_tokens: { type: Number, default: 0 },
  total_cache_read: { type: Number, default: 0 },
  total_cache_write: { type: Number, default: 0 },
  message_count: { type: Number, default: 0 },
  usage_five_hour_pct: { type: Number, default: null },
  usage_seven_day_pct: { type: Number, default: null },
  usage_seven_day_sonnet_pct: { type: Number, default: null },
  received_at: { type: Date, default: Date.now },
})

// Query indexes — common filters: by device, by user, by seat, ordered by time
claudeSessionSchema.index({ device_id: 1, started_at: -1 })
claudeSessionSchema.index({ user_id: 1, started_at: -1 })
claudeSessionSchema.index({ seat_id: 1, started_at: -1 })
claudeSessionSchema.index({ started_at: -1 })

export const ClaudeSession = mongoose.model<IClaudeSession>('ClaudeSession', claudeSessionSchema)
