import { describe, it, expect, beforeEach } from "vitest";
import { GET as getSummary } from "@/app/api/dashboard/summary/route";
import { GET as getEnhanced } from "@/app/api/dashboard/enhanced/route";
import { createTestToken, createUserToken } from "../helpers/auth-helper";
import { seedTestData, seedUsageSnapshot, seedAlert } from "../helpers/db-helper";
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
    expect(body).toHaveProperty("activeAlerts");
    expect(body).toHaveProperty("totalSnapshots");
    expect(body.activeAlerts).toBe(0);
    expect(body.totalSnapshots).toBe(0);
  });

  it("returns correct counts with seeded data", async () => {
    const { seat } = await seedTestData();
    await seedUsageSnapshot(String(seat._id));
    await seedAlert(String(seat._id));

    const token = createTestToken();
    const req = makeRequest("/api/dashboard/summary", { token });
    const res = await getSummary(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.activeAlerts).toBe(1);
    expect(body.totalSnapshots).toBe(1);
    expect(typeof body.avgAllPct).toBe("number");
  });

  it("averages usage across snapshots correctly", async () => {
    const { seat } = await seedTestData();
    const { Seat } = await import("@/models/seat");
    const { UsageSnapshot } = await import("@/models/usage-snapshot");
    const otherSeat = await Seat.create({ email: "other@seat.com", label: "Other", team: "dev", max_users: 2 });
    await UsageSnapshot.create({
      seat_id: seat._id,
      raw_response: {},
      seven_day_pct: 60,
      fetched_at: new Date(),
    });
    await UsageSnapshot.create({
      seat_id: otherSeat._id,
      raw_response: {},
      seven_day_pct: 80,
      fetched_at: new Date(),
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
    const { seat } = await seedTestData();
    await seedUsageSnapshot(String(seat._id));
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
    await seedTestData();

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
