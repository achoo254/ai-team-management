import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/seats/route";
import { PUT, DELETE } from "@/app/api/seats/[id]/route";
import { createTestToken, createUserToken } from "../helpers/auth-helper";
import { seedTestData } from "../helpers/db-helper";
import { makeRequest } from "../helpers/request-helper";
import { Seat } from "@/models/seat";
import { User } from "@/models/user";

describe("GET /api/seats", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 401 without token", async () => {
    const req = makeRequest("/api/seats");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns seats with assigned users", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/seats", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("seats");
    expect(Array.isArray(body.seats)).toBe(true);
    expect(body.seats.length).toBeGreaterThan(0);
    // Each seat should have a users array
    expect(body.seats[0]).toHaveProperty("users");
    expect(Array.isArray(body.seats[0].users)).toBe(true);
  });
});

describe("POST /api/seats", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 403 for non-admin user", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/seats", {
      method: "POST",
      body: JSON.stringify({ email: "new@test.com", label: "New Seat" }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates seat with admin token", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/seats", {
      method: "POST",
      body: JSON.stringify({ email: "new@test.com", label: "New Seat", max_users: 3 }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe("new@test.com");
    expect(body.label).toBe("New Seat");
  });

  it("returns 400 when required fields are missing", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/seats", {
      method: "POST",
      body: JSON.stringify({ email: "new@test.com" }), // missing label
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("PUT /api/seats/[id]", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 403 for non-admin user", async () => {
    const seat = await Seat.findOne();
    const seatId = String(seat!._id);
    const token = createUserToken();
    const req = makeRequest(`/api/seats/${seatId}`, {
      method: "PUT",
      body: JSON.stringify({ label: "Updated" }),
      token,
    });
    const res = await PUT(req, { params: Promise.resolve({ id: seatId }) });
    expect(res.status).toBe(403);
  });

  it("updates seat with admin token", async () => {
    const seat = await Seat.findOne();
    const seatId = String(seat!._id);
    const token = createTestToken();
    const req = makeRequest(`/api/seats/${seatId}`, {
      method: "PUT",
      body: JSON.stringify({ label: "Updated Label" }),
      token,
    });
    const res = await PUT(req, { params: Promise.resolve({ id: seatId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.label).toBe("Updated Label");
  });

  it("returns 400 for invalid ObjectId", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/seats/invalid-id", {
      method: "PUT",
      body: JSON.stringify({ label: "X" }),
      token,
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "invalid-id" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent seat", async () => {
    const token = createTestToken();
    const nonExistentId = "507f1f77bcf86cd799439099";
    const req = makeRequest(`/api/seats/${nonExistentId}`, {
      method: "PUT",
      body: JSON.stringify({ label: "X" }),
      token,
    });
    const res = await PUT(req, { params: Promise.resolve({ id: nonExistentId }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/seats/[id]", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 403 for non-admin user", async () => {
    const seat = await Seat.findOne();
    const seatId = String(seat!._id);
    const token = createUserToken();
    const req = makeRequest(`/api/seats/${seatId}`, { method: "DELETE", token });
    const res = await DELETE(req, { params: Promise.resolve({ id: seatId }) });
    expect(res.status).toBe(403);
  });

  it("deletes seat and unassigns users", async () => {
    const seat = await Seat.findOne();
    const seatId = String(seat!._id);
    const token = createTestToken();
    const req = makeRequest(`/api/seats/${seatId}`, { method: "DELETE", token });
    const res = await DELETE(req, { params: Promise.resolve({ id: seatId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Seat deleted");

    // Verify seat is gone
    const deleted = await Seat.findById(seatId);
    expect(deleted).toBeNull();

    // Verify users are unassigned
    const assignedUsers = await User.find({ seat_id: seatId });
    expect(assignedUsers.length).toBe(0);
  });

  it("returns 404 for non-existent seat", async () => {
    const token = createTestToken();
    const nonExistentId = "507f1f77bcf86cd799439099";
    const req = makeRequest(`/api/seats/${nonExistentId}`, { method: "DELETE", token });
    const res = await DELETE(req, { params: Promise.resolve({ id: nonExistentId }) });
    expect(res.status).toBe(404);
  });
});
