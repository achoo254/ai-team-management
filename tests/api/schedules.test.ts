import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "@/app/api/schedules/route";
import { POST } from "@/app/api/schedules/assign/route";
import { DELETE } from "@/app/api/schedules/entry/route";
import { PATCH } from "@/app/api/schedules/swap/route";
import { createTestToken, createUserToken } from "../helpers/auth-helper";
import { seedTestData, seedSchedule } from "../helpers/db-helper";
import { makeRequest } from "../helpers/request-helper";
import { Schedule } from "@/models/schedule";
import { User } from "@/models/user";

describe("GET /api/schedules", () => {
  beforeEach(async () => {
    const { seat, user } = await seedTestData();
    await seedSchedule(String(seat._id), String(user._id));
  });

  it("returns 401 without token", async () => {
    const req = makeRequest("/api/schedules");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns all schedules", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/schedules", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("schedules");
    expect(Array.isArray(body.schedules)).toBe(true);
    expect(body.schedules.length).toBe(1);
  });

  it("filters by seatId query param", async () => {
    const schedule = await Schedule.findOne();
    const seatId = String(schedule!.seat_id);
    const token = createTestToken();
    const req = makeRequest(`/api/schedules?seatId=${seatId}`, { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schedules.length).toBe(1);
  });

  it("returns empty array for unknown seatId", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/schedules?seatId=507f1f77bcf86cd799439099", { token });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schedules.length).toBe(0);
  });
});

describe("POST /api/schedules/assign", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 403 for non-admin user", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/schedules/assign", {
      method: "POST",
      body: JSON.stringify({ seatId: "x", userId: "x", dayOfWeek: 1, slot: "morning" }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("assigns user to schedule cell", async () => {
    const user = await User.findOne();
    const seatId = String(user!.seat_id);
    const userId = String(user!._id);
    const token = createTestToken();
    const req = makeRequest("/api/schedules/assign", {
      method: "POST",
      body: JSON.stringify({ seatId, userId, dayOfWeek: 2, slot: "afternoon" }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("_id");
    expect(body.slot).toBe("afternoon");
  });

  it("returns 400 when user does not belong to seat", async () => {
    // beforeEach already seeded — look up existing user and create a second seat
    const user = await User.findOne();
    const { Seat } = await import("@/models/seat");
    const seat2 = await Seat.create({ email: "other@test.com", label: "Other", max_users: 2 });
    const token = createTestToken();
    const req = makeRequest("/api/schedules/assign", {
      method: "POST",
      body: JSON.stringify({
        seatId: String(seat2._id),
        userId: String(user._id),
        dayOfWeek: 3,
        slot: "morning",
      }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/does not belong/i);
  });

  it("returns 400 when required fields are missing", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/schedules/assign", {
      method: "POST",
      body: JSON.stringify({ seatId: "x" }), // missing userId, dayOfWeek, slot
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid seatId format", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/schedules/assign", {
      method: "POST",
      body: JSON.stringify({ seatId: "not-valid", userId: "507f1f77bcf86cd799439011", dayOfWeek: 1, slot: "morning" }),
      token,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/schedules/entry", () => {
  beforeEach(async () => {
    const { seat, user } = await seedTestData();
    await seedSchedule(String(seat._id), String(user._id));
  });

  it("returns 403 for non-admin user", async () => {
    const schedule = await Schedule.findOne();
    const token = createUserToken();
    const req = makeRequest("/api/schedules/entry", {
      method: "DELETE",
      body: JSON.stringify({
        seatId: String(schedule!.seat_id),
        dayOfWeek: schedule!.day_of_week,
        slot: schedule!.slot,
      }),
      token,
    });
    const res = await DELETE(req);
    expect(res.status).toBe(403);
  });

  it("removes schedule entry", async () => {
    const schedule = await Schedule.findOne();
    const token = createTestToken();
    const req = makeRequest("/api/schedules/entry", {
      method: "DELETE",
      body: JSON.stringify({
        seatId: String(schedule!.seat_id),
        dayOfWeek: schedule!.day_of_week,
        slot: schedule!.slot,
      }),
      token,
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Schedule entry removed");

    const remaining = await Schedule.countDocuments();
    expect(remaining).toBe(0);
  });

  it("returns 404 for non-existent entry", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/schedules/entry", {
      method: "DELETE",
      body: JSON.stringify({
        seatId: "507f1f77bcf86cd799439099",
        dayOfWeek: 5,
        slot: "morning",
      }),
      token,
    });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when required fields missing", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/schedules/entry", {
      method: "DELETE",
      body: JSON.stringify({ seatId: "x" }), // missing dayOfWeek and slot
      token,
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/schedules/swap", () => {
  it("returns 403 for non-admin user", async () => {
    const token = createUserToken();
    const req = makeRequest("/api/schedules/swap", {
      method: "PATCH",
      body: JSON.stringify({
        from: { seatId: "x", dayOfWeek: 1, slot: "morning" },
        to: { seatId: "x", dayOfWeek: 2, slot: "morning" },
      }),
      token,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("moves schedule entry to empty cell", async () => {
    const { seat, user } = await seedTestData();
    const seatId = String(seat._id);
    await seedSchedule(seatId, String(user._id));

    const token = createTestToken();
    const req = makeRequest("/api/schedules/swap", {
      method: "PATCH",
      body: JSON.stringify({
        from: { seatId, dayOfWeek: 1, slot: "morning" },
        to: { seatId, dayOfWeek: 3, slot: "afternoon" },
      }),
      token,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Schedule updated");

    // Source should be gone, target should exist
    const fromEntry = await Schedule.findOne({ seat_id: seatId, day_of_week: 1, slot: "morning" });
    expect(fromEntry).toBeNull();
    const toEntry = await Schedule.findOne({ seat_id: seatId, day_of_week: 3, slot: "afternoon" });
    expect(toEntry).not.toBeNull();
  });

  it("swaps two schedule entries", async () => {
    const { seat, user } = await seedTestData();
    const seatId = String(seat._id);
    const userId = String(user._id);

    // Create a second user for the same seat
    const user2 = await User.create({
      name: "User Two",
      email: "user2@test.com",
      role: "user",
      seat_ids: [seat._id],
    });

    await Schedule.create({ seat_id: seatId, user_id: userId, day_of_week: 1, slot: "morning" });
    await Schedule.create({ seat_id: seatId, user_id: String(user2._id), day_of_week: 2, slot: "morning" });

    const token = createTestToken();
    const req = makeRequest("/api/schedules/swap", {
      method: "PATCH",
      body: JSON.stringify({
        from: { seatId, dayOfWeek: 1, slot: "morning" },
        to: { seatId, dayOfWeek: 2, slot: "morning" },
      }),
      token,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
  });

  it("returns 404 when source entry not found", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/schedules/swap", {
      method: "PATCH",
      body: JSON.stringify({
        from: { seatId: "507f1f77bcf86cd799439099", dayOfWeek: 1, slot: "morning" },
        to: { seatId: "507f1f77bcf86cd799439099", dayOfWeek: 2, slot: "morning" },
      }),
      token,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when from or to is missing", async () => {
    const token = createTestToken();
    const req = makeRequest("/api/schedules/swap", {
      method: "PATCH",
      body: JSON.stringify({ from: { seatId: "x", dayOfWeek: 1, slot: "morning" } }), // missing to
      token,
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
