import mongoose, { Schema, type Document, type Types } from 'mongoose'

export interface ITeam extends Document {
  name: string
  color: string
  created_by: Types.ObjectId
  created_at: Date
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true },
    color: { type: String, default: '#3b82f6' },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
)

teamSchema.index({ created_by: 1, name: 1 }, { unique: true })

export const Team = mongoose.model<ITeam>('Team', teamSchema)
