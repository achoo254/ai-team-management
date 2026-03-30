import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/usage-log/week/route";
import { POST } from "@/app/api/usage-log/bulk/route";
import { createTestToken, createUserToken } from "../helpers/auth-helper";
import { seedTestData, seedUsageLog } from "../helpers/db-helper";
import { makeRequest } from "../helpers/request-helper";
import { UsageLog } from "@/models/usage-log";

describe("GET /api/usage-log/week", () => {
  beforeEach(async () => {
    const { seat, user } = await seedTestData();
    await seedUsageLog(seat.email, String(user._id));
  });

  it("returns 401 without token", async () => {
    const req = makeRequest("/api/usage-log/week");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns weekly data per seat", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/usage-log/week", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("weekStart");
    expect(body).toHaveProperty("seats");
    expect(Array.isArray(body.seats)).toBe(true);
  });

  it("filters by weekStart query param", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/usage-log/week?weekStart=2026-03-23", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weekStart).toBe("2026-03-23");
    // The seeded seat should have log data for this week
    const seatedEntry = body.seats.find((s: { weeklyAllPct: number | null }) => s.weeklyAllPct !== null);
    expect(seatedEntry).toBeDefined();
    expect(seatedEntry.weeklyAllPct).toBe(50);
  });

  it("returns null usage fields for seats with no log data", async () => {
    const token = createTestToken();
    // Use a week with no logs
    const req = makeRequest("/api/usage-log/week?weekStart=2020-01-06", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.seats.every((s: { weeklyAllPct: null }) => s.weeklyAllPct === null)).toBe(true);
  });

  it("non-admin can access (auth only)", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/usage-log/week", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

describe("POST /api/usage-log/bulk", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 403 for non-admin user", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/usage-log/bulk", {
      method: "POST",
      body: JSON.stringify({
        weekStart: "2026-03-23",
        entries: [{ seatEmail: "seat@test.com", weeklyAllPct: 60, weeklySonnetPct: 40 }],
      }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 401 without token", async () => {
    const req = makeRequest("/api/usage-log/bulk", {
      method: "POST",
      body: JSON.stringify({ weekStart: "2026-03-23", entries: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates usage logs for valid Monday weekStart", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/usage-log/bulk", {
      method: "POST",
      body: JSON.stringify({
        weekStart: "2026-03-23", // Monday
        entries: [
          { seatEmail: "seat@test.com", weeklyAllPct: 75, weeklySonnetPct: 50 },
        ],
      }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("results");
    expect(body).toHaveProperty("errors");
    expect(body.results.length).toBe(1);
    expect(body.errors.length).toBe(0);
    expect(body.results[0].weekly_all_pct).toBe(75);
  });

  it("returns 400 when weekStart is not a Monday", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/usage-log/bulk", {
      method: "POST",
      body: JSON.stringify({
        weekStart: "2026-03-24", // Tuesday
        entries: [{ seatEmail: "seat@test.com", weeklyAllPct: 50, weeklySonnetPct: 30 }],
      }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/monday/i);
  });

  it("returns 400 when weekStart is missing", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/usage-log/bulk", {
      method: "POST",
      body: JSON.stringify({
        entries: [{ seatEmail: "seat@test.com", weeklyAllPct: 50, weeklySonnetPct: 30 }],
      }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when entries is empty array", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/usage-log/bulk", {
      method: "POST",
      body: JSON.stringify({ weekStart: "2026-03-23", entries: [] }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/non-empty/i);
  });

  it("upserts log on duplicate weekStart + seatEmail + user_id", async () => {
    const token = createTestToken();
    const payload = {
      weekStart: "2026-03-23",
      entries: [{ seatEmail: "seat@test.com", weeklyAllPct: 50, weeklySonnetPct: 30 }],
    };
    // First insert
    await POST(makeRequest("/api/usage-log/bulk", { method: "POST", body: JSON.stringify(payload), token }));
    // Second insert (upsert) with different values
    const req2 = makeRequest("/api/usage-log/bulk", {
      method: "POST",
      body: JSON.stringify({ ...payload, entries: [{ seatEmail: "seat@test.com", weeklyAllPct: 90, weeklySonnetPct: 70 }] }),
      token,
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.results[0].weekly_all_pct).toBe(90);
    // Only one log should exist (upserted)
    const count = await UsageLog.countDocuments({ seat_email: "seat@test.com", week_start: "2026-03-23" });
    expect(count).toBe(1);
  });

  it("clamps pct values to 0-100 range", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/usage-log/bulk", {
      method: "POST",
      body: JSON.stringify({
        weekStart: "2026-03-23",
        entries: [{ seatEmail: "seat@test.com", weeklyAllPct: 150, weeklySonnetPct: -10 }],
      }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.results[0].weekly_all_pct).toBe(100);
    expect(body.results[0].weekly_sonnet_pct).toBe(0);
  });
});
