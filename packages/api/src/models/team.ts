import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface ITeam extends Document {
  name: string
  description: string | null
  seat_ids: Types.ObjectId[]
  member_ids: Types.ObjectId[]
  owner_id: Types.ObjectId
  created_at: Date
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    description: { type: String, default: null, maxlength: 500 },
    seat_ids: [{ type: Schema.Types.ObjectId, ref: 'Seat' }],
    member_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    owner_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

// Index for getAllowedSeatIds() lookups
teamSchema.index({ member_ids: 1 })

export const Team = mongoose.model<ITeam>('Team', teamSchema)
