import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { UsageLog } from "@/models/usage-log";
import { Seat } from "@/models/seat";
import { getCurrentWeekStart, logUsage } from "@/services/usage-sync-service";

/** Create a test seat and return its _id as string */
async function createTestSeat(email: string): Promise<string> {
  const seat = await Seat.create({ email, label: email.split("@")[0], team: "dev", max_users: 2 });
  return String(seat._id);
}

describe("usage-sync-service", () => {
  describe("getCurrentWeekStart()", () => {
    it("returns a string in YYYY-MM-DD format", () => {
      const result = getCurrentWeekStart();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns a date that is the Monday of the current local week", () => {
      const result = getCurrentWeekStart();
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const expectedMonday = new Date(now.getFullYear(), now.getMonth(), diff);
      const expected = expectedMonday.toISOString().split("T")[0];
      expect(result).toBe(expected);
    });

    it("returns the current week's Monday, not a future or distant past date", () => {
      const result = getCurrentWeekStart();
      const monday = new Date(result + "T00:00:00Z");
      const now = new Date();
      const diffDays = Math.abs((now.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeLessThan(7);
    });
  });

  describe("logUsage()", () => {
    it("creates a UsageLog document in MongoDB", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const seatId = await createTestSeat("sync@test.com");

      await logUsage({ seatId, userId, weekStart: "2026-03-23", weeklyAllPct: 65 });

      const doc = await UsageLog.findOne({ seat_id: seatId, week_start: "2026-03-23" });
      expect(doc).not.toBeNull();
      expect(doc!.weekly_all_pct).toBe(65);
      expect(doc!.user_id.toString()).toBe(userId);
    });

    it("returns { success: true, weekStart, seatId }", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const seatId = await createTestSeat("return@test.com");

      const result = await logUsage({ seatId, userId, weekStart: "2026-03-23", weeklyAllPct: 50 });

      expect(result).toEqual({
        success: true,
        weekStart: "2026-03-23",
        seatId,
      });
    });

    it("persists correct values — weeklyAllPct 0 allowed", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const seatId = await createTestSeat("zero@test.com");

      await logUsage({ seatId, userId, weekStart: "2026-03-23", weeklyAllPct: 0 });

      const doc = await UsageLog.findOne({ seat_id: seatId });
      expect(doc).not.toBeNull();
      expect(doc!.weekly_all_pct).toBe(0);
    });

    it("stores multiple logs for different seats in the same week without conflict", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const seatIdA = await createTestSeat("a@test.com");
      const seatIdB = await createTestSeat("b@test.com");

      await logUsage({ seatId: seatIdA, userId, weekStart: "2026-03-23", weeklyAllPct: 10 });
      await logUsage({ seatId: seatIdB, userId, weekStart: "2026-03-23", weeklyAllPct: 20 });

      const count = await UsageLog.countDocuments({ week_start: "2026-03-23" });
      expect(count).toBe(2);
    });
  });
});
