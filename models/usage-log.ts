import mongoose, { Schema, model, models, type Document, type Types } from "mongoose";

export interface IUsageLog extends Document {
  seat_email: string;
  week_start: string;
  weekly_all_pct: number;
  weekly_sonnet_pct: number;
  user_id: Types.ObjectId;
  logged_at: Date;
}

const usageLogSchema = new Schema<IUsageLog>({
  seat_email: { type: String, required: true },
  week_start: { type: String, required: true },
  weekly_all_pct: { type: Number, default: 0 },
  weekly_sonnet_pct: { type: Number, default: 0 },
  user_id: { type: Schema.Types.ObjectId, ref: "User" },
  logged_at: { type: Date, default: Date.now },
});

// Compound unique: one log per seat/week/user
usageLogSchema.index({ seat_email: 1, week_start: 1, user_id: 1 }, { unique: true });
usageLogSchema.index({ seat_email: 1, week_start: 1 });

export const UsageLog = models.UsageLog || model<IUsageLog>("UsageLog", usageLogSchema);
