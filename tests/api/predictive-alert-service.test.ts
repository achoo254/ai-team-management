import { describe, it, expect, vi } from "vitest";
import { Types } from "mongoose";
import { checkFastBurnAlerts, checkQuotaForecastAlerts } from "@/services/predictive-alert-service";
import type { IUser } from "@/models/user";
import type { InsertAlertFn } from "@/services/alert-service";

// Mock forecastSeatQuota to avoid DB dependency
vi.mock("@/services/quota-forecast-service", () => ({
  forecastSeatQuota: vi.fn(),
}));

import { forecastSeatQuota } from "@/services/quota-forecast-service";
const mockForecast = vi.mocked(forecastSeatQuota);

/** Create a minimal IUser-like object for testing. */
function makeUser(seatId: string, overrides: {
  burn_rate_threshold?: number | null;
  eta_warning_hours?: number | null;
  forecast_warning_hours?: number | null;
  threshold_5h_pct?: number;
  threshold_7d_pct?: number;
} = {}): IUser {
  const uid = new Types.ObjectId();
  return {
    _id: uid,
    name: "Tester",
    role: "user",
    active: true,
    fcm_tokens: [],
    push_enabled: false,
    alert_settings: { enabled: true, telegram_enabled: false, token_failure_enabled: true },
    watched_seats: [{
      seat_id: new Types.ObjectId(seatId),
      threshold_5h_pct: overrides.threshold_5h_pct ?? 90,
      threshold_7d_pct: overrides.threshold_7d_pct ?? 85,
      burn_rate_threshold: overrides.burn_rate_threshold !== undefined ? overrides.burn_rate_threshold : 15,
      eta_warning_hours: overrides.eta_warning_hours !== undefined ? overrides.eta_warning_hours : 1.5,
      forecast_warning_hours: overrides.forecast_warning_hours !== undefined ? overrides.forecast_warning_hours : 48,
    }],
  } as unknown as IUser;
}

function makeSeatMap(seatId: string, label = "TestSeat") {
  return new Map([[seatId, { _id: seatId, label, email: "test@test.com" }]]);
}

describe("predictive-alert-service", () => {
  describe("checkFastBurnAlerts", () => {
    const seatId = new Types.ObjectId().toString();

    function makeSnapshot(fiveHourPct: number, resetsAtMs: number) {
      return [{
        _id: seatId,
        snapshot: {
          five_hour_pct: fiveHourPct,
          five_hour_resets_at: new Date(resetsAtMs).toISOString(),
        },
      }];
    }

    it("triggers when velocity high AND ETA short", async () => {
      const insertFn = vi.fn().mockResolvedValue(true);
      const now = Date.now();
      // resetsAt = now + 1h → cycleStart = resetsAt - 5h = now - 4h → hoursElapsed = 4h
      // fiveHourPct = 80% → velocity = 80/4 = 20%/h (>15), ETA = 20/20 = 1h (<=1.5)
      const resetsAt = now + 1 * 3600_000;
      const snapshots = makeSnapshot(80, resetsAt);

      const result = await checkFastBurnAlerts(
        snapshots, makeSeatMap(seatId), [makeUser(seatId)], insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).toHaveBeenCalledOnce();
      expect(result).toBe(1);
      expect(insertFn.mock.calls[0][2]).toBe("fast_burn");
      expect(insertFn.mock.calls[0][3]).toBe("5h");
    });

    it("no alert when velocity high but ETA long", async () => {
      const insertFn = vi.fn();
      const now = Date.now();
      // resetsAt = now + 3h → cycleStart = now - 2h → hoursElapsed = 2h
      // fiveHourPct = 30% → velocity = 15%/h (>=15), ETA = 70/15 = 4.67h (>1.5) → skip
      const resetsAt = now + 3 * 3600_000;
      const snapshots = makeSnapshot(30, resetsAt);

      await checkFastBurnAlerts(
        snapshots, makeSeatMap(seatId), [makeUser(seatId)], insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("no alert when ETA short but velocity low", async () => {
      const insertFn = vi.fn();
      const now = Date.now();
      // resetsAt = now + 0.5h → cycleStart = now - 4.5h → hoursElapsed = 4.5h
      // fiveHourPct = 95% → velocity = 95/4.5 = 21.1%/h (high), ETA = 5/21.1 = 0.24h (short)
      // → Would trigger. Let's use low velocity instead:
      // resetsAt = now + 4h → cycleStart = now - 1h → hoursElapsed = 1h
      // fiveHourPct = 10% → velocity = 10%/h (<15) → skip
      const resetsAt = now + 4 * 3600_000;
      const snapshots = makeSnapshot(10, resetsAt);

      await checkFastBurnAlerts(
        snapshots, makeSeatMap(seatId), [makeUser(seatId)], insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("noise guard: skips first 30 min of cycle", async () => {
      const insertFn = vi.fn();
      const now = Date.now();
      // resetsAt = now + 4.8h → cycleStart = now - 0.2h → hoursElapsed = 0.2h (<0.5)
      const resetsAt = now + 4.8 * 3600_000;
      const snapshots = makeSnapshot(90, resetsAt);

      await checkFastBurnAlerts(
        snapshots, makeSeatMap(seatId), [makeUser(seatId)], insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("skips when burn_rate_threshold is null (disabled)", async () => {
      const insertFn = vi.fn();
      const now = Date.now();
      const resetsAt = now + 1 * 3600_000;
      const snapshots = makeSnapshot(80, resetsAt);
      const user = makeUser(seatId, { burn_rate_threshold: null });

      await checkFastBurnAlerts(
        snapshots, makeSeatMap(seatId), [user], insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("skips when eta_warning_hours is null (disabled)", async () => {
      const insertFn = vi.fn();
      const now = Date.now();
      const resetsAt = now + 1 * 3600_000;
      const snapshots = makeSnapshot(80, resetsAt);
      const user = makeUser(seatId, { eta_warning_hours: null });

      await checkFastBurnAlerts(
        snapshots, makeSeatMap(seatId), [user], insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("skips when fiveHourPct is null", async () => {
      const insertFn = vi.fn();
      const snapshots = [{ _id: seatId, snapshot: { five_hour_pct: null, five_hour_resets_at: new Date().toISOString() } }];

      await checkFastBurnAlerts(
        snapshots, makeSeatMap(seatId), [makeUser(seatId)], insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("skips when fiveHourPct is 0", async () => {
      const insertFn = vi.fn();
      const now = Date.now();
      const resetsAt = now + 1 * 3600_000;
      const snapshots = makeSnapshot(0, resetsAt);

      await checkFastBurnAlerts(
        snapshots, makeSeatMap(seatId), [makeUser(seatId)], insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("skips when hoursElapsed is negative (clock drift)", async () => {
      const insertFn = vi.fn();
      const now = Date.now();
      // resetsAt = now + 6h → cycleStart = now + 1h → hoursElapsed = -1h → skip
      const resetsAt = now + 6 * 3600_000;
      const snapshots = makeSnapshot(80, resetsAt);

      await checkFastBurnAlerts(
        snapshots, makeSeatMap(seatId), [makeUser(seatId)], insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });
  });

  describe("checkQuotaForecastAlerts", () => {
    const seatId = new Types.ObjectId().toString();

    it("triggers when projected to hit threshold before reset within warning window", async () => {
      const insertFn = vi.fn().mockResolvedValue(true);
      const now = new Date();
      // slope 1%/h, current 60%, threshold 85% → 25h to threshold
      // reset in 72h → 25h < 72h AND 25h < 48h warning → trigger
      mockForecast.mockResolvedValue({
        seat_id: seatId, seat_label: "TestSeat", current_pct: 60,
        slope_per_hour: 1, hours_to_full: 40, forecast_at: null,
        status: "warning", resets_at: new Date(now.getTime() + 72 * 3600_000).toISOString(),
      });

      const result = await checkQuotaForecastAlerts(
        [seatId], makeSeatMap(seatId),
        [makeUser(seatId, { threshold_7d_pct: 85 })],
        insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).toHaveBeenCalledOnce();
      expect(result).toBe(1);
      expect(insertFn.mock.calls[0][2]).toBe("quota_forecast");
      expect(insertFn.mock.calls[0][3]).toBe("7d");
    });

    it("no alert when hits after reset (reset_first)", async () => {
      const insertFn = vi.fn();
      const now = new Date();
      // slope 0.5%/h, current 60%, threshold 85% → 50h to threshold
      // reset in 30h → 50h > 30h → skip (resets before reaching threshold)
      mockForecast.mockResolvedValue({
        seat_id: seatId, seat_label: "TestSeat", current_pct: 60,
        slope_per_hour: 0.5, hours_to_full: 80, forecast_at: null,
        status: "reset_first", resets_at: new Date(now.getTime() + 30 * 3600_000).toISOString(),
      });

      await checkQuotaForecastAlerts(
        [seatId], makeSeatMap(seatId),
        [makeUser(seatId, { threshold_7d_pct: 85 })],
        insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("no alert when outside warning window", async () => {
      const insertFn = vi.fn();
      const now = new Date();
      // slope 0.3%/h, current 60%, threshold 85% → 83h to threshold
      // reset in 120h → 83h < 120h BUT 83h > 48h warning → skip
      mockForecast.mockResolvedValue({
        seat_id: seatId, seat_label: "TestSeat", current_pct: 60,
        slope_per_hour: 0.3, hours_to_full: 133, forecast_at: null,
        status: "watch", resets_at: new Date(now.getTime() + 120 * 3600_000).toISOString(),
      });

      await checkQuotaForecastAlerts(
        [seatId], makeSeatMap(seatId),
        [makeUser(seatId, { threshold_7d_pct: 85 })],
        insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("no alert when already above threshold", async () => {
      const insertFn = vi.fn();
      const now = new Date();
      mockForecast.mockResolvedValue({
        seat_id: seatId, seat_label: "TestSeat", current_pct: 87,
        slope_per_hour: 1, hours_to_full: 13, forecast_at: null,
        status: "critical", resets_at: new Date(now.getTime() + 72 * 3600_000).toISOString(),
      });

      await checkQuotaForecastAlerts(
        [seatId], makeSeatMap(seatId),
        [makeUser(seatId, { threshold_7d_pct: 85 })],
        insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("no alert when slope is decreasing (<=0)", async () => {
      const insertFn = vi.fn();
      mockForecast.mockResolvedValue({
        seat_id: seatId, seat_label: "TestSeat", current_pct: 60,
        slope_per_hour: -0.5, hours_to_full: null, forecast_at: null,
        status: "safe_decreasing", resets_at: new Date().toISOString(),
      });

      await checkQuotaForecastAlerts(
        [seatId], makeSeatMap(seatId),
        [makeUser(seatId, { threshold_7d_pct: 85 })],
        insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("skips when forecast_warning_hours is null (disabled)", async () => {
      const insertFn = vi.fn();
      const now = new Date();
      mockForecast.mockResolvedValue({
        seat_id: seatId, seat_label: "TestSeat", current_pct: 60,
        slope_per_hour: 1, hours_to_full: 40, forecast_at: null,
        status: "warning", resets_at: new Date(now.getTime() + 72 * 3600_000).toISOString(),
      });

      await checkQuotaForecastAlerts(
        [seatId], makeSeatMap(seatId),
        [makeUser(seatId, { threshold_7d_pct: 85, forecast_warning_hours: null })],
        insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });

    it("no alert when resets_at is null", async () => {
      const insertFn = vi.fn();
      mockForecast.mockResolvedValue({
        seat_id: seatId, seat_label: "TestSeat", current_pct: 60,
        slope_per_hour: 1, hours_to_full: 40, forecast_at: null,
        status: "collecting", resets_at: null,
      });

      await checkQuotaForecastAlerts(
        [seatId], makeSeatMap(seatId),
        [makeUser(seatId, { threshold_7d_pct: 85 })],
        insertFn as unknown as InsertAlertFn,
      );

      expect(insertFn).not.toHaveBeenCalled();
    });
  });
});
