import mongoose, { Schema, type Document } from 'mongoose'

export interface ISeat extends Document {
  email: string
  label: string
  team: 'dev' | 'mkt'
  max_users: number
  access_token: string | null
  token_active: boolean
  last_fetched_at: Date | null
  last_fetch_error: string | null
  created_at: Date
}

const seatSchema = new Schema<ISeat>(
  {
    email: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    team: { type: String, required: true, enum: ['dev', 'mkt'] },
    max_users: { type: Number, default: 3 },
    access_token: { type: String, default: null },
    token_active: { type: Boolean, default: false },
    last_fetched_at: { type: Date, default: null },
    last_fetch_error: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Auto-exclude access_token from find/findOne queries (defense-in-depth for .lean())
// Callers needing access_token must explicitly .select('+access_token')
seatSchema.pre(/^find/, function () {
  const selected = this.getOptions()?.projection || this.projection()
  if (!selected || !('access_token' in (selected as Record<string, unknown>))) {
    this.select('-access_token')
  }
})

// Virtual: computed has_token for frontend (avoids exposing raw token)
seatSchema.virtual('has_token').get(function () {
  return this.access_token != null
})

// Auto-exclude access_token from all JSON responses
seatSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.access_token
    return ret
  },
})

export const Seat = mongoose.model<ISeat>('Seat', seatSchema)
