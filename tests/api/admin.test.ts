import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as getUsers, POST as postUser } from "@/app/api/admin/users/route";
import { POST as postCheckAlerts } from "@/app/api/admin/check-alerts/route";
import { POST as postSendReport } from "@/app/api/admin/send-report/route";
import { createTestToken, createUserToken } from "../helpers/auth-helper";
import { seedTestData } from "../helpers/db-helper";
import { makeRequest } from "../helpers/request-helper";
import { User } from "@/models/user";

// Mock external services to avoid real network calls
vi.mock("@/services/alert-service", () => ({
  checkAlerts: vi.fn().mockResolvedValue({ alertsCreated: 0 }),
}));

vi.mock("@/services/telegram-service", () => ({
  sendWeeklyReport: vi.fn().mockResolvedValue(undefined),
}));

describe("GET /api/admin/users", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 401 without token", async () => {
    const req = makeRequest("/api/admin/users");
    const res = await getUsers(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/admin/users", { token });
    const res = await getUsers(req);
    expect(res.status).toBe(403);
  });

  it("returns users with seat info", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/admin/users", { token });
    const res = await getUsers(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("users");
    expect(Array.isArray(body.users)).toBe(true);
    expect(body.users.length).toBeGreaterThan(0);
    const u = body.users[0];
    expect(u).toHaveProperty("id");
    expect(u).toHaveProperty("name");
    expect(u).toHaveProperty("role");
    expect(u).toHaveProperty("seat_label");
    expect(u).toHaveProperty("seat_email");
  });
});

describe("POST /api/admin/users", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 403 for non-admin user", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ name: "New User", email: "new@test.com" }),
      token,
    });
    const res = await postUser(req);
    expect(res.status).toBe(403);
  });

  it("creates user with admin token", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ name: "New User", email: "newuser@test.com", role: "user" }),
      token,
    });
    const res = await postUser(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("New User");
    expect(body.email).toBe("newuser@test.com");
    expect(body.role).toBe("user");
  });

  it("creates user with seatId assignment", async () => {
    // beforeEach already seeded; just look up the existing seat
    const { Seat } = await import("@/models/seat");
    const seat = await Seat.findOne();
    const token = createTestToken();
    const req = makeRequest("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Seated User",
        email: "seated@test.com",
        role: "user",
        seatId: String(seat._id),
      }),
      token,
    });
    const res = await postUser(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(String(body.seat_id)).toBe(String(seat._id));
  });

  it("defaults role to user when not specified", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({ name: "Default Role", email: "defaultrole@test.com" }),
      token,
    });
    const res = await postUser(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.role).toBe("user");
  });
});

describe("POST /api/admin/check-alerts", () => {
  it("returns 401 without token", async () => {
    const req = makeRequest("/api/admin/check-alerts", { method: "POST", body: JSON.stringify({}) });
    const res = await postCheckAlerts(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/admin/check-alerts", { method: "POST", body: JSON.stringify({}), token });
    const res = await postCheckAlerts(req);
    expect(res.status).toBe(403);
  });

  it("runs alert check and returns result", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/admin/check-alerts", { method: "POST", body: JSON.stringify({}), token });
    const res = await postCheckAlerts(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("alertsCreated");
    expect(body.alertsCreated).toBe(0);
  });
});

describe("POST /api/admin/send-report", () => {
  it("returns 401 without token", async () => {
    const req = makeRequest("/api/admin/send-report", { method: "POST", body: JSON.stringify({}) });
    const res = await postSendReport(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/admin/send-report", { method: "POST", body: JSON.stringify({}), token });
    const res = await postSendReport(req);
    expect(res.status).toBe(403);
  });

  it("sends report and returns success", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/admin/send-report", { method: "POST", body: JSON.stringify({}), token });
    const res = await postSendReport(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
