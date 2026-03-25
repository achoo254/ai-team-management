import mongoose, { Schema, model, models, type Document, type Types } from "mongoose";

export interface IUser extends Document {
  name: string;
  email?: string;
  role: "admin" | "user";
  team: "dev" | "mkt";
  seat_id: Types.ObjectId | null;
  active: boolean;
  created_at: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    team: { type: String, required: true, enum: ["dev", "mkt"] },
    seat_id: { type: Schema.Types.ObjectId, ref: "Seat", default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } },
);

export const User = models.User || model<IUser>("User", userSchema);
