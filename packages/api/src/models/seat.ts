import mongoose, { Schema, type Document } from 'mongoose'

export interface IOAuthCredential {
  access_token: string | null
  refresh_token: string | null
  expires_at: Date | null
  scopes: string[]
  subscription_type: string | null
  rate_limit_tier: string | null
}

export interface ISeat extends Document {
  email: string
  label: string
  team: 'dev' | 'mkt'
  max_users: number
  oauth_credential: IOAuthCredential | null
  token_active: boolean
  last_fetched_at: Date | null
  last_fetch_error: string | null
  last_refreshed_at: Date | null
  created_at: Date
}

const seatSchema = new Schema<ISeat>(
  {
    email: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    team: { type: String, required: true, enum: ['dev', 'mkt'] },
    max_users: { type: Number, default: 3 },
    oauth_credential: {
      type: {
        access_token: { type: String, default: null },
        refresh_token: { type: String, default: null },
        expires_at: { type: Date, default: null },
        scopes: { type: [String], default: [] },
        subscription_type: { type: String, default: null },
        rate_limit_tier: { type: String, default: null },
      },
      default: null,
      select: false,
    },
    token_active: { type: Boolean, default: false },
    last_fetched_at: { type: Date, default: null },
    last_fetch_error: { type: String, default: null },
    last_refreshed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// oauth_credential excluded by default via `select: false`
// Callers needing tokens must use .select('+oauth_credential')

// Strip sensitive token values from JSON, keep metadata
seatSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    if (ret.oauth_credential) {
      delete ret.oauth_credential.access_token
      delete ret.oauth_credential.refresh_token
    }
    return ret
  },
})

export const Seat = mongoose.model<ISeat>('Seat', seatSchema)
