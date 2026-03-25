import mongoose, { Schema, model, models, type Document } from "mongoose";

export interface ITeam extends Document {
  name: string;
  label: string;
  color: string;
  created_at: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    color: { type: String, default: "#3b82f6" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

export const Team = models.Team || model<ITeam>("Team", teamSchema);
