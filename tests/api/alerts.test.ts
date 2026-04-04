import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/alerts/route";
import { createTestToken, createUserToken } from "../helpers/auth-helper";
import { seedTestData, seedAlert } from "../helpers/db-helper";
import { makeRequest } from "../helpers/request-helper";
import { Alert } from "@/models/alert";

describe("GET /api/alerts", () => {
  beforeEach(async () => {
    const { seat } = await seedTestData();
    await seedAlert(String(seat._id));
    // Seed a resolved alert
    await Alert.create({
      seat_id: seat._id,
      type: "token_failure",
      message: "Token error",
      metadata: { error: "invalid_token" },
      resolved: true,
      resolved_by: "admin@test.com",
      resolved_at: new Date(),
    });
  });

  it("returns 401 without token", async () => {
    const req = makeRequest("/api/alerts");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns all alerts when no filter", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/alerts", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("alerts");
    expect(Array.isArray(body.alerts)).toBe(true);
    expect(body.alerts.length).toBe(2);
  });

  it("returns only unresolved alerts with ?resolved=0", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/alerts?resolved=0", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts.length).toBe(1);
    expect(body.alerts[0].resolved).toBe(false);
  });

  it("returns only resolved alerts with ?resolved=1", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/alerts?resolved=1", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alerts.length).toBe(1);
    expect(body.alerts[0].resolved).toBe(true);
  });

  it("returns alerts for non-admin user too (auth only)", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/alerts", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
