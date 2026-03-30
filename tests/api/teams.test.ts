import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/teams/route";
import { PUT, DELETE } from "@/app/api/teams/[id]/route";
import { createTestToken, createUserToken } from "../helpers/auth-helper";
import { seedTestData } from "../helpers/db-helper";
import { makeRequest } from "../helpers/request-helper";
import { Team } from "@/models/team";
import { User } from "@/models/user";
import { Seat } from "@/models/seat";

describe("GET /api/teams", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 401 without token", async () => {
    const req = makeRequest("/api/teams");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns teams with user_count and seat_count", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/teams", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("teams");
    expect(Array.isArray(body.teams)).toBe(true);
    expect(body.teams.length).toBeGreaterThan(0);
    expect(body.teams[0]).toHaveProperty("user_count");
    expect(body.teams[0]).toHaveProperty("seat_count");
  });
});

describe("POST /api/teams", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 403 for non-admin user", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/teams", {
      method: "POST",
      body: JSON.stringify({ name: "qa", label: "QA", color: "#10b981" }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("creates team with admin token", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/teams", {
      method: "POST",
      body: JSON.stringify({ name: "QA", label: "QA Team", color: "#10b981" }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    // name is lowercased by route
    expect(body.name).toBe("qa");
    expect(body.label).toBe("QA Team");
  });

  it("returns 401 without token", async () => {
    const req = makeRequest("/api/teams", {
      method: "POST",
      body: JSON.stringify({ name: "qa", label: "QA", color: "#10b981" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/teams/[id]", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 403 for non-admin user", async () => {
    const team = await Team.findOne();
    const teamId = String(team!._id);
    const token = createUserToken();
    const req = makeRequest(`/api/teams/${teamId}`, {
      method: "PUT",
      body: JSON.stringify({ label: "Updated" }),
      token,
    });
    const res = await PUT(req, { params: Promise.resolve({ id: teamId }) });
    expect(res.status).toBe(403);
  });

  it("updates team label and color", async () => {
    const team = await Team.findOne();
    const teamId = String(team!._id);
    const token = createTestToken();
    const req = makeRequest(`/api/teams/${teamId}`, {
      method: "PUT",
      body: JSON.stringify({ label: "Dev Updated", color: "#ff0000" }),
      token,
    });
    const res = await PUT(req, { params: Promise.resolve({ id: teamId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.label).toBe("Dev Updated");
    expect(body.color).toBe("#ff0000");
  });

  it("returns 404 for non-existent team", async () => {
    const token = createTestToken();
    const nonExistentId = "507f1f77bcf86cd799439099";
    const req = makeRequest(`/api/teams/${nonExistentId}`, {
      method: "PUT",
      body: JSON.stringify({ label: "X" }),
      token,
    });
    const res = await PUT(req, { params: Promise.resolve({ id: nonExistentId }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/teams/[id]", () => {
  it("returns 400 when team has users or seats", async () => {
    const { team } = await seedTestData();
    const teamId = String(team._id);
    const token = createTestToken();
    const req = makeRequest(`/api/teams/${teamId}`, { method: "DELETE", token });
    const res = await DELETE(req, { params: Promise.resolve({ id: teamId }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/cannot delete/i);
  });

  it("deletes empty team", async () => {
    // Create a team with no users or seats
    const emptyTeam = await Team.create({ name: "empty", label: "Empty", color: "#000" });
    const teamId = String(emptyTeam._id);
    const token = createTestToken();
    const req = makeRequest(`/api/teams/${teamId}`, { method: "DELETE", token });
    const res = await DELETE(req, { params: Promise.resolve({ id: teamId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const deleted = await Team.findById(teamId);
    expect(deleted).toBeNull();
  });

  it("returns 403 for non-admin user", async () => {
    const { team } = await seedTestData();
    const teamId = String(team._id);
    const token = createUserToken();
    const req = makeRequest(`/api/teams/${teamId}`, { method: "DELETE", token });
    const res = await DELETE(req, { params: Promise.resolve({ id: teamId }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 for non-existent team", async () => {
    const token = createTestToken();
    const nonExistentId = "507f1f77bcf86cd799439099";
    const req = makeRequest(`/api/teams/${nonExistentId}`, { method: "DELETE", token });
    const res = await DELETE(req, { params: Promise.resolve({ id: nonExistentId }) });
    expect(res.status).toBe(404);
  });
});
