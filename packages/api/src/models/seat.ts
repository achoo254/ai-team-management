import mongoose, { Schema, type Document, type Types } from 'mongoose'

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
  max_users: number
  owner_id: Types.ObjectId | null
  oauth_credential: IOAuthCredential | null
  token_active: boolean
  last_fetched_at: Date | null
  last_fetch_error: string | null
  last_refreshed_at: Date | null
  created_at: Date
  deleted_at: Date | null
}

const seatSchema = new Schema<ISeat>(
  {
    email: { type: String, required: true },
    label: { type: String, required: true },
    max_users: { type: Number, default: 3 },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
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
    deleted_at: { type: Date, default: null, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Partial unique index on email — only enforced for non-deleted seats.
// Allows recreating a seat with the same email after soft delete.
// NOTE: If DB has legacy unique index on `email`, drop it manually:
//   db.seats.dropIndex('email_1')
seatSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { deleted_at: null } })

// Auto-filter out soft-deleted seats on all find/count queries.
// Callers needing deleted seats (e.g. cleanup service) must pass `deleted_at` in filter explicitly.
// Mongoose v9: pre-hooks no longer receive `next` callback — use async/Promise style.
const addNotDeletedFilter = function (this: mongoose.Query<unknown, unknown>) {
  const filter = this.getFilter()
  if (!('deleted_at' in filter)) {
    this.where({ deleted_at: null })
  }
}
seatSchema.pre(/^find/, addNotDeletedFilter as never)
seatSchema.pre('countDocuments', addNotDeletedFilter as never)
seatSchema.pre('count' as never, addNotDeletedFilter as never)

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
