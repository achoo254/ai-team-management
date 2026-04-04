import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface IUser extends Document {
  name: string
  email?: string
  role: 'admin' | 'user'
  team?: 'dev' | 'mkt'
  seat_ids?: Types.ObjectId[]
  active: boolean
  telegram_bot_token?: string | null  // encrypted via AES-256-GCM
  telegram_chat_id?: string | null
  created_at: Date
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    team: { type: String, enum: ['dev', 'mkt'] },
    seat_ids: [{ type: Schema.Types.ObjectId, ref: 'Seat' }],
    active: { type: Boolean, default: true },
    telegram_bot_token: { type: String, default: null },
    telegram_chat_id: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Strip token from JSON output, expose has_telegram_bot boolean
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // has_telegram_bot computed from ret (which has all fields if selected) or chat_id as proxy
    const hasToken = !!ret.telegram_bot_token
    delete ret.telegram_bot_token
    ret.has_telegram_bot = hasToken && !!ret.telegram_chat_id
    return ret
  },
})

export const User = mongoose.model<IUser>('User', userSchema)
