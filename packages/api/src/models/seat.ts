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
    access_token: { type: String, default: null, select: false },
    token_active: { type: Boolean, default: false },
    last_fetched_at: { type: Date, default: null },
    last_fetch_error: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// access_token excluded by default via `select: false` on field
// Callers needing it must explicitly use .select('+access_token')

// Auto-exclude access_token from JSON responses (defense-in-depth)
seatSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    delete ret.access_token
    return ret
  },
})

export const Seat = mongoose.model<ISeat>('Seat', seatSchema)
