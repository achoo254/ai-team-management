import { describe, it, expect, beforeEach } from "vitest";
import { GET as getSummary } from "@/app/api/dashboard/summary/route";
import { GET as getEnhanced } from "@/app/api/dashboard/enhanced/route";
import { createTestToken, createUserToken } from "../helpers/auth-helper";
import { seedTestData, seedUsageLog, seedAlert } from "../helpers/db-helper";
import { makeRequest } from "../helpers/request-helper";

describe("GET /api/dashboard/summary", () => {
  it("returns 401 without token", async () => {
    const req = makeRequest("/api/dashboard/summary");
    const res = await getSummary(req);
    expect(res.status).toBe(401);
  });

  it("returns summary with zero counts when no data", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/dashboard/summary", { token });
    const res = await getSummary(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("avgAllPct");
    expect(body).not.toHaveProperty("avgSonnetPct");
    expect(body).toHaveProperty("activeAlerts");
    expect(body).toHaveProperty("totalLogs");
    expect(body.activeAlerts).toBe(0);
    expect(body.totalLogs).toBe(0);
  });

  it("returns correct counts with seeded data", async () => {
    const { seat, user } = await seedTestData();
    await seedUsageLog(String(seat._id), String(user._id));
    await seedAlert(String(seat._id)); // unresolved alert

    const token = createTestToken();
    const req = makeRequest("/api/dashboard/summary", { token });
    const res = await getSummary(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeAlerts).toBe(1);
    expect(body.totalLogs).toBe(1);
    expect(typeof body.avgAllPct).toBe("number");
    expect(body).not.toHaveProperty("avgSonnetPct");
  });

  it("averages usage across logs correctly", async () => {
    const { seat, user } = await seedTestData();
    // Seed two logs for same week
    const { UsageLog } = await import("@/models/usage-log");
    const { Seat } = await import("@/models/seat");
    const otherSeat = await Seat.create({ email: "other@seat.com", label: "Other", team: "dev", max_users: 2 });
    await UsageLog.create({
      seat_id: seat._id,
      week_start: "2026-03-23",
      weekly_all_pct: 60,
      user_id: user._id,
    });
    await UsageLog.create({
      seat_id: otherSeat._id,
      week_start: "2026-03-23",
      weekly_all_pct: 80,
      user_id: user._id,
    });

    const token = createTestToken();
    const req = makeRequest("/api/dashboard/summary", { token });
    const res = await getSummary(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.avgAllPct).toBe(70); // (60+80)/2
  });

  it("non-admin user can access", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/dashboard/summary", { token });
    const res = await getSummary(req);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/dashboard/enhanced", () => {
  it("returns 401 without token", async () => {
    const req = makeRequest("/api/dashboard/enhanced");
    const res = await getEnhanced(req);
    expect(res.status).toBe(401);
  });

  it("returns full dashboard data shape", async () => {
    const { seat, user } = await seedTestData();
    await seedUsageLog(String(seat._id), String(user._id));
    await seedAlert(String(seat._id));

    const token = createTestToken();
    const req = makeRequest("/api/dashboard/enhanced", { token });
    const res = await getEnhanced(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveProperty("totalUsers");
    expect(body).toHaveProperty("activeUsers");
    expect(body).toHaveProperty("totalSeats");
    expect(body).toHaveProperty("unresolvedAlerts");
    expect(body).toHaveProperty("todaySchedules");
    expect(body).toHaveProperty("usagePerSeat");
    expect(body).toHaveProperty("usageTrend");
    expect(body).toHaveProperty("teamUsage");

    expect(Array.isArray(body.todaySchedules)).toBe(true);
    expect(Array.isArray(body.usagePerSeat)).toBe(true);
    expect(Array.isArray(body.usageTrend)).toBe(true);
    expect(Array.isArray(body.teamUsage)).toBe(true);
  });

  it("returns correct user and seat counts", async () => {
    const { seat, user } = await seedTestData();

    const token = createTestToken();
    const req = makeRequest("/api/dashboard/enhanced", { token });
    const res = await getEnhanced(req);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totalUsers).toBeGreaterThanOrEqual(1);
    expect(body.totalSeats).toBeGreaterThanOrEqual(1);
    expect(body.unresolvedAlerts).toBe(0);
  });

  it("non-admin user can access", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/dashboard/enhanced", { token });
    const res = await getEnhanced(req);
    expect(res.status).toBe(200);
  });
});
