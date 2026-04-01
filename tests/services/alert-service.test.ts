import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { Seat } from "@/models/seat";
import { UsageLog } from "@/models/usage-log";
import { Alert } from "@/models/alert";
import { checkAlerts } from "@/services/alert-service";

// Helper: get this week's Monday YYYY-MM-DD
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  return monday.toISOString().split("T")[0];
}

// Helper: get a past week_start string older than 1 week
function oldWeekStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().split("T")[0];
}

describe("alert-service: checkAlerts()", () => {
  describe("Rule 1 – high_usage alerts", () => {
    it("creates a high_usage alert when seat usage >= 80%", async () => {
      const seat = await Seat.create({ email: "high@test.com", label: "High Seat", team: "dev", max_users: 2 });
      await UsageLog.create({
        seat_id: seat._id,
        week_start: currentWeekStart(),
        weekly_all_pct: 90,
        user_id: new mongoose.Types.ObjectId(),
      });

      const result = await checkAlerts();

      expect(result.alertsCreated).toBe(1);
      const alert = await Alert.findOne({ seat_id: seat._id, type: "high_usage" });
      expect(alert).not.toBeNull();
      expect(alert!.message).toContain("90%");
    });

    it("does NOT create an alert when usage is below threshold (< 80%)", async () => {
      const seat = await Seat.create({ email: "low@test.com", label: "Low Seat", team: "dev", max_users: 2 });
      await UsageLog.create({
        seat_id: seat._id,
        week_start: currentWeekStart(),
        weekly_all_pct: 50,
        user_id: new mongoose.Types.ObjectId(),
      });

      const result = await checkAlerts();

      expect(result.alertsCreated).toBe(0);
      const alert = await Alert.findOne({ seat_id: seat._id, type: "high_usage" });
      expect(alert).toBeNull();
    });

    it("does NOT create a duplicate alert when same seat+type alert already exists today", async () => {
      const seat = await Seat.create({ email: "dup@test.com", label: "Dup Seat", team: "dev", max_users: 2 });
      await UsageLog.create({
        seat_id: seat._id,
        week_start: currentWeekStart(),
        weekly_all_pct: 85,
        user_id: new mongoose.Types.ObjectId(),
      });

      // Pre-seed an existing alert for today
      await Alert.create({ seat_id: seat._id, type: "high_usage", message: "Existing alert" });

      const result = await checkAlerts();

      expect(result.alertsCreated).toBe(0);
      const alerts = await Alert.find({ seat_id: seat._id, type: "high_usage" });
      expect(alerts).toHaveLength(1);
    });
  });

  describe("Rule 2 – no_activity alerts", () => {
    it("creates a no_activity alert for seat with old logs but no recent logs", async () => {
      const seat = await Seat.create({ email: "inactive@test.com", label: "Inactive Seat", team: "dev", max_users: 2 });
      await UsageLog.create({
        seat_id: seat._id,
        week_start: oldWeekStr(),
        weekly_all_pct: 30,
        user_id: new mongoose.Types.ObjectId(),
      });

      const result = await checkAlerts();

      expect(result.alertsCreated).toBe(1);
      const alert = await Alert.findOne({ seat_id: seat._id, type: "no_activity" });
      expect(alert).not.toBeNull();
    });

    it("does NOT create no_activity alert for seat with recent logs", async () => {
      const seat = await Seat.create({ email: "active@test.com", label: "Active Seat", team: "dev", max_users: 2 });
      await UsageLog.create({
        seat_id: seat._id,
        week_start: currentWeekStart(),
        weekly_all_pct: 30,
        user_id: new mongoose.Types.ObjectId(),
      });

      const result = await checkAlerts();

      expect(result.alertsCreated).toBe(0);
      const alert = await Alert.findOne({ seat_id: seat._id, type: "no_activity" });
      expect(alert).toBeNull();
    });

    it("does NOT create no_activity alert for seat that has never logged", async () => {
      await Seat.create({ email: "never@test.com", label: "Never Logged Seat", team: "dev", max_users: 2 });

      const result = await checkAlerts();

      expect(result.alertsCreated).toBe(0);
    });
  });

  it("returns { alertsCreated: N } with correct count across multiple seats", async () => {
    // Seat 1: high usage
    const s1 = await Seat.create({ email: "s1@test.com", label: "S1", team: "dev", max_users: 2 });
    await UsageLog.create({
      seat_id: s1._id,
      week_start: currentWeekStart(),
      weekly_all_pct: 95,
      user_id: new mongoose.Types.ObjectId(),
    });

    // Seat 2: inactive (old log only)
    const s2 = await Seat.create({ email: "s2@test.com", label: "S2", team: "dev", max_users: 2 });
    await UsageLog.create({
      seat_id: s2._id,
      week_start: oldWeekStr(),
      weekly_all_pct: 20,
      user_id: new mongoose.Types.ObjectId(),
    });

    // Seat 3: normal usage — no alert
    const s3 = await Seat.create({ email: "s3@test.com", label: "S3", team: "dev", max_users: 2 });
    await UsageLog.create({
      seat_id: s3._id,
      week_start: currentWeekStart(),
      weekly_all_pct: 40,
      user_id: new mongoose.Types.ObjectId(),
    });

    const result = await checkAlerts();

    expect(result.alertsCreated).toBe(2);
  });
});
