import mongoose, { Schema, type Document } from 'mongoose'
import { config } from '../config.js'

export interface ISetting extends Document {
  alerts: {
    rate_limit_pct: number
    extra_credit_pct: number
  }
  telegram: {
    bot_token: string
    chat_id: string
    topic_id: string
  }
}

const settingSchema = new Schema<ISetting>({
  alerts: {
    rate_limit_pct: { type: Number, default: config.alerts.defaultRateLimitPct },
    extra_credit_pct: { type: Number, default: config.alerts.defaultExtraCreditPct },
  },
  telegram: {
    bot_token: { type: String, default: '' },
    chat_id: { type: String, default: '' },
    topic_id: { type: String, default: '' },
  },
})

export const Setting = mongoose.model<ISetting>('Setting', settingSchema)

/** Get the single settings document, creating with defaults if none exists (atomic) */
export async function getOrCreateSettings(): Promise<ISetting> {
  const doc = await Setting.findOneAndUpdate(
    {},
    { $setOnInsert: {
      alerts: {
        rate_limit_pct: config.alerts.defaultRateLimitPct,
        extra_credit_pct: config.alerts.defaultExtraCreditPct,
      },
    }},
    { upsert: true, new: true },
  )
  return doc
}
