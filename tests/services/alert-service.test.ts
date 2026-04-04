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

/** Helper: create a user subscribed to a seat with alert thresholds */
async function createSubscribedUser(seatId: string, thresholds = { rate_limit_pct: 80, extra_credit_pct: 80 }) {
  return User.create({
    name: "Subscriber",
    email: `sub-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
    role: "admin",
    watched_seat_ids: [seatId],
    alert_settings: { enabled: true, ...thresholds },
    telegram_bot_token: "fake-token",
    telegram_chat_id: "123",
  });
}

describe("alert-service: checkSnapshotAlerts()", () => {
  describe("rate_limit alerts", () => {
    it("creates rate_limit alert when snapshot pct >= threshold", async () => {
      const seat = await Seat.create({ email: "high@test.com", label: "High Seat", team: "dev", max_users: 2 });
      await createSubscribedUser(String(seat._id));
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 90, seven_day_pct: 50, fetched_at: new Date(),
      });

      const result = await checkSnapshotAlerts();

      expect(result.alertsCreated).toBe(1);
      const alert = await Alert.findOne({ seat_id: seat._id, type: "rate_limit" });
      expect(alert).not.toBeNull();
      expect(alert!.message).toContain("90%");
      expect(alert!.metadata).toMatchObject({ session: "5h", pct: 90 });
    });

    it("picks highest usage session for alert", async () => {
      const seat = await Seat.create({ email: "multi@test.com", label: "Multi Session", team: "dev", max_users: 2 });
      await createSubscribedUser(String(seat._id));
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 82, seven_day_pct: 95, seven_day_sonnet_pct: 88, fetched_at: new Date(),
      });

      await checkSnapshotAlerts();

      const alert = await Alert.findOne({ seat_id: seat._id, type: "rate_limit" });
      expect(alert!.metadata).toMatchObject({ session: "7d", pct: 95 });
    });

    it("does NOT create alert when usage is below threshold", async () => {
      const seat = await Seat.create({ email: "low@test.com", label: "Low Seat", team: "dev", max_users: 2 });
      await createSubscribedUser(String(seat._id));
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 50, seven_day_pct: 30, fetched_at: new Date(),
      });

      const result = await checkSnapshotAlerts();
      expect(result.alertsCreated).toBe(0);
    });

    it("does NOT create duplicate within cooldown window", async () => {
      const seat = await Seat.create({ email: "dup@test.com", label: "Dup Seat", team: "dev", max_users: 2 });
      await createSubscribedUser(String(seat._id));
      // Existing recent alert (within 1h cooldown)
      await Alert.create({ seat_id: seat._id, type: "rate_limit", message: "Existing", metadata: {}, read_by: [] });
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 95, fetched_at: new Date(),
      });

      const result = await checkSnapshotAlerts();

      expect(result.alertsCreated).toBe(0);
    });

    it("respects per-user threshold", async () => {
      const seat = await Seat.create({ email: "custom@test.com", label: "Custom", team: "dev", max_users: 2 });
      await createSubscribedUser(String(seat._id), { rate_limit_pct: 95, extra_credit_pct: 80 });
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 90, fetched_at: new Date(),
      });

      const result = await checkSnapshotAlerts();
      // 90% < 95% threshold → no alert
      expect(result.alertsCreated).toBe(0);
    });
  });

  describe("extra_credit alerts", () => {
    it("creates extra_credit alert when utilization >= threshold", async () => {
      const seat = await Seat.create({ email: "extra@test.com", label: "Extra Seat", team: "dev", max_users: 2 });
      await createSubscribedUser(String(seat._id));
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 10,
        extra_usage: { is_enabled: true, monthly_limit: 100, used_credits: 85, utilization: 85 },
        fetched_at: new Date(),
      });

      await checkSnapshotAlerts();

      const alert = await Alert.findOne({ seat_id: seat._id, type: "extra_credit" });
      expect(alert).not.toBeNull();
      expect(alert!.metadata).toMatchObject({ pct: 85, credits_used: 85, credits_limit: 100 });
    });

    it("does NOT create alert when extra_usage is disabled", async () => {
      const seat = await Seat.create({ email: "disabled@test.com", label: "Disabled", team: "dev", max_users: 2 });
      await createSubscribedUser(String(seat._id));
      await UsageSnapshot.create({
        seat_id: seat._id, raw_response: {},
        five_hour_pct: 10,
        extra_usage: { is_enabled: false, monthly_limit: 100, used_credits: 85, utilization: 85 },
        fetched_at: new Date(),
      });

      const result = await checkSnapshotAlerts();
      const alert = await Alert.findOne({ seat_id: seat._id, type: "extra_credit" });
      expect(alert).toBeNull();
    });
  });

  describe("token_failure alerts", () => {
    it("creates token_failure alert for seat with active token + fetch error", async () => {
      const seat = await Seat.create({
        email: "fail@test.com", label: "Fail Seat", team: "dev", max_users: 2,
        token_active: true, last_fetch_error: "invalid_grant",
      });
      await createSubscribedUser(String(seat._id));

      await checkSnapshotAlerts();

      const alert = await Alert.findOne({ type: "token_failure" });
      expect(alert).not.toBeNull();
      expect(alert!.metadata).toMatchObject({ error: "invalid_grant" });
    });

    it("does NOT create token_failure for seat without token_active", async () => {
      await Seat.create({
        email: "inactive@test.com", label: "Inactive Token", team: "dev", max_users: 2,
        token_active: false, last_fetch_error: "some_error",
      });

      await checkSnapshotAlerts();
      const alert = await Alert.findOne({ type: "token_failure" });
      expect(alert).toBeNull();
    });
  });

  it("counts alerts across multiple seats and types", async () => {
    // Seat 1: rate_limit
    const s1 = await Seat.create({ email: "s1@test.com", label: "S1", team: "dev", max_users: 2 });
    await createSubscribedUser(String(s1._id));
    await UsageSnapshot.create({
      seat_id: s1._id, raw_response: {}, five_hour_pct: 95, fetched_at: new Date(),
    });

    // Seat 2: token_failure
    const s2 = await Seat.create({
      email: "s2@test.com", label: "S2", team: "dev", max_users: 2,
      token_active: true, last_fetch_error: "timeout",
    });
    await createSubscribedUser(String(s2._id));

    // Seat 3: normal — no alert
    const s3 = await Seat.create({ email: "s3@test.com", label: "S3", team: "dev", max_users: 2 });
    await createSubscribedUser(String(s3._id));
    await UsageSnapshot.create({
      seat_id: s3._id, raw_response: {}, five_hour_pct: 40, fetched_at: new Date(),
    });

    const result = await checkSnapshotAlerts();
    expect(result.alertsCreated).toBe(2);
  });
});
