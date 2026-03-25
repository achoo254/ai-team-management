import mongoose, { Schema, model, models, type Document } from "mongoose";

export interface ISeat extends Document {
  email: string;
  label: string;
  team: "dev" | "mkt";
  max_users: number;
  created_at: Date;
}

const seatSchema = new Schema<ISeat>(
  {
    email: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    team: { type: String, required: true, enum: ["dev", "mkt"] },
    max_users: { type: Number, default: 3 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

export const Seat = models.Seat || model<ISeat>("Seat", seatSchema);
