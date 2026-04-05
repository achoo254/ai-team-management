import { describe, it, expect, vi } from "vitest";
import { Seat } from "@/models/seat";
import { User } from "@/models/user";
import { UsageSnapshot } from "@/models/usage-snapshot";
import { Alert } from "@/models/alert";
import { checkSnapshotAlerts } from "@/services/alert-service";

// Mock telegram + fcm to avoid actual sends
vi.mock("@/services/telegram-service", () => ({
  sendAlertToUser: vi.fn(),
}));
vi.mock("@/services/fcm-service", () => ({
  sendPushToUser: vi.fn(),
}));

interface WatchEntry { seat_id: string; threshold_5h_pct?: number; threshold_7d_pct?: number }

/** Helper: create a user watching seats with thresholds + alert enabled */
async function createWatcher(watches: WatchEntry[], options: {
  telegram_enabled?: boolean
  token_failure_enabled?: boolean
  alerts_enabled?: boolean
} = {}) {
  return User.create({
    name: "Watcher",
    email: `w-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    role: "admin",
    watched_seats: watches.map((w) => ({
      seat_id: w.seat_id,
      threshold_5h_pct: w.threshold_5h_pct ?? 90,
      threshold_7d_pct: w.threshold_7d_pct ?? 85,
    })),
    alert_settings: {
      enabled: options.alerts_enabled ?? true,
      telegram_enabled: options.telegram_enabled ?? true,
      token_failure_enabled: options.token_failure_enabled ?? true,
    },
    telegram_bot_token: "fake-token",
    telegram_chat_id: "123",
  });
}

describe("alert-service: checkSnapshotAlerts()", () => {
  describe("rate_limit (per-user dedup)", () => {
    it("creates 5h alert when snapshot pct >= user's threshold_5h_pct", async () => {
      const seat = await Seat.create({ email: "high@test.com", label: "High", max_users: 2 });
      const user = await createWatcher([{ seat_id: String(seat._id), threshold_5h_pct: 80 }]);
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 90, seven_day_pct: 50, fetched_at: new Date(),
      });

      const result = await checkSnapshotAlerts();

      expect(result.alertsCreated).toBe(1);
      const alert = await Alert.findOne({ user_id: user._id, seat_id: seat._id, type: "rate_limit", window: "5h" });
      expect(alert).not.toBeNull();
      expect(alert!.metadata).toMatchObject({ pct: 90, threshold: 80 });
    });

    it("creates 7d alert using max of 3 variants", async () => {
      const seat = await Seat.create({ email: "multi@test.com", label: "Multi", max_users: 2 });
      const user = await createWatcher([{ seat_id: String(seat._id), threshold_7d_pct: 85 }]);
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 40, seven_day_pct: 70, seven_day_sonnet_pct: 95, seven_day_opus_pct: 50,
        fetched_at: new Date(),
      });

      await checkSnapshotAlerts();

      const alert = await Alert.findOne({ user_id: user._id, seat_id: seat._id, type: "rate_limit", window: "7d" });
      expect(alert).not.toBeNull();
      expect(alert!.metadata).toMatchObject({ max_pct: 95, threshold: 85 });
    });

    it("2 users watching same seat with different thresholds → each gets alerted at their own threshold", async () => {
      const seat = await Seat.create({ email: "shared@test.com", label: "Shared", max_users: 2 });
      const userA = await createWatcher([{ seat_id: String(seat._id), threshold_5h_pct: 80 }]);
      const userB = await createWatcher([{ seat_id: String(seat._id), threshold_5h_pct: 95 }]);
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 90, fetched_at: new Date(),
      });

      await checkSnapshotAlerts();

      const alertA = await Alert.findOne({ user_id: userA._id, seat_id: seat._id, type: "rate_limit" });
      const alertB = await Alert.findOne({ user_id: userB._id, seat_id: seat._id, type: "rate_limit" });
      expect(alertA).not.toBeNull();
      expect(alertB).toBeNull(); // 90% < 95% threshold for B
    });

    it("does NOT create duplicate for same user within 24h cooldown", async () => {
      const seat = await Seat.create({ email: "dup@test.com", label: "Dup", max_users: 2 });
      const user = await createWatcher([{ seat_id: String(seat._id), threshold_5h_pct: 80 }]);
      // Seed recent notified alert
      await Alert.create({
        user_id: user._id, seat_id: seat._id, type: "rate_limit", window: "5h",
        message: "Existing", metadata: {}, read_by: [], notified_at: new Date(),
      });
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {}, five_hour_pct: 95, fetched_at: new Date(),
      });

      const result = await checkSnapshotAlerts();
      expect(result.alertsCreated).toBe(0);
    });

    it("does NOT create alert when alerts disabled for user", async () => {
      const seat = await Seat.create({ email: "off@test.com", label: "Off", max_users: 2 });
      await createWatcher([{ seat_id: String(seat._id), threshold_5h_pct: 50 }], { alerts_enabled: false });
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {}, five_hour_pct: 90, fetched_at: new Date(),
      });

      const result = await checkSnapshotAlerts();
      expect(result.alertsCreated).toBe(0);
    });
  });

  describe("token_failure (per-user)", () => {
    it("creates token_failure alert per watcher with token_failure_enabled", async () => {
      const seat = await Seat.create({
        email: "fail@test.com", label: "Fail", max_users: 2,
        token_active: true, last_fetch_error: "invalid_grant",
      });
      const user = await createWatcher([{ seat_id: String(seat._id) }]);

      await checkSnapshotAlerts();

      const alert = await Alert.findOne({ user_id: user._id, type: "token_failure" });
      expect(alert).not.toBeNull();
      expect(alert!.metadata).toMatchObject({ error: "invalid_grant" });
    });

    it("skips user when token_failure_enabled=false", async () => {
      const seat = await Seat.create({
        email: "skip@test.com", label: "Skip", max_users: 2,
        token_active: true, last_fetch_error: "boom",
      });
      await createWatcher([{ seat_id: String(seat._id) }], { token_failure_enabled: false });

      const result = await checkSnapshotAlerts();
      expect(result.alertsCreated).toBe(0);
    });
  });
});
