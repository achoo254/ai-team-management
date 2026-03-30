import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { UsageLog } from "@/models/usage-log";
import { getCurrentWeekStart, logUsage } from "@/services/usage-sync-service";

describe("usage-sync-service", () => {
  describe("getCurrentWeekStart()", () => {
    it("returns a string in YYYY-MM-DD format", () => {
      const result = getCurrentWeekStart();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns a date that is the Monday of the current local week", () => {
      const result = getCurrentWeekStart();
      // Compute expected Monday using the same local-time algorithm as the service.
      // We compare the result string against the independently computed expected value
      // rather than re-parsing through Date to avoid UTC/local timezone conversion issues.
      const now = new Date();
      const day = now.getDay(); // 0=Sun
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
      // Must be within the past 7 days
      expect(diffDays).toBeLessThan(7);
    });
  });

  describe("logUsage()", () => {
    it("creates a UsageLog document in MongoDB", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const params = {
        seatEmail: "sync@test.com",
        userId,
        weekStart: "2026-03-23",
        weeklyAllPct: 65,
        weeklySonnetPct: 30,
      };

      await logUsage(params);

      const doc = await UsageLog.findOne({ seat_email: "sync@test.com", week_start: "2026-03-23" });
      expect(doc).not.toBeNull();
      expect(doc!.weekly_all_pct).toBe(65);
      expect(doc!.weekly_sonnet_pct).toBe(30);
      expect(doc!.user_id.toString()).toBe(userId);
    });

    it("returns { success: true, weekStart, seatEmail }", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      const result = await logUsage({
        seatEmail: "return@test.com",
        userId,
        weekStart: "2026-03-23",
        weeklyAllPct: 50,
        weeklySonnetPct: 25,
      });

      expect(result).toEqual({
        success: true,
        weekStart: "2026-03-23",
        seatEmail: "return@test.com",
      });
    });

    it("persists correct values — weeklyAllPct 0 allowed", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      await logUsage({
        seatEmail: "zero@test.com",
        userId,
        weekStart: "2026-03-23",
        weeklyAllPct: 0,
        weeklySonnetPct: 0,
      });

      const doc = await UsageLog.findOne({ seat_email: "zero@test.com" });
      expect(doc).not.toBeNull();
      expect(doc!.weekly_all_pct).toBe(0);
      expect(doc!.weekly_sonnet_pct).toBe(0);
    });

    it("stores multiple logs for different seats in the same week without conflict", async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      await logUsage({ seatEmail: "a@test.com", userId, weekStart: "2026-03-23", weeklyAllPct: 10, weeklySonnetPct: 5 });
      await logUsage({ seatEmail: "b@test.com", userId, weekStart: "2026-03-23", weeklyAllPct: 20, weeklySonnetPct: 10 });

      const count = await UsageLog.countDocuments({ week_start: "2026-03-23" });
      expect(count).toBe(2);
    });
  });
});
