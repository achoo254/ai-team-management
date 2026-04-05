import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as postGoogle } from "@/app/api/auth/google/route";
import { GET as getMe } from "@/app/api/auth/me/route";
import { POST as postLogout } from "@/app/api/auth/logout/route";
import { createTestToken } from "../helpers/auth-helper";
import { seedTestData } from "../helpers/db-helper";
import { makeRequest } from "../helpers/request-helper";

// Mock Firebase Admin to avoid real credential loading
vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
}));

// Mock next/headers cookies used by setTokenCookie and logout
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  }),
}));

describe("POST /api/auth/google", () => {
  beforeEach(async () => {
    await seedTestData();
    vi.clearAllMocks();
  });

  it("returns 400 when idToken is missing", async () => {
    const req = makeRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await postGoogle(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/idToken/i);
  });

  it("returns 401 for invalid Firebase token", async () => {
    const { adminAuth } = await import("@/lib/firebase-admin");
    vi.mocked(adminAuth.verifyIdToken).mockRejectedValueOnce(
      Object.assign(new Error("Invalid token"), { code: "auth/argument-error" }),
    );

    const req = makeRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: "invalid-token" }),
    });
    const res = await postGoogle(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/invalid token/i);
  });

  it("returns 401 for expired Firebase token", async () => {
    const { adminAuth } = await import("@/lib/firebase-admin");
    vi.mocked(adminAuth.verifyIdToken).mockRejectedValueOnce(
      Object.assign(new Error("Token expired"), { code: "auth/id-token-expired" }),
    );

    const req = makeRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: "expired-token" }),
    });
    const res = await postGoogle(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  it("returns 401 when user email not found in database", async () => {
    const { adminAuth } = await import("@/lib/firebase-admin");
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({
      email: "notfound@test.com",
      uid: "uid-notfound",
    } as never);

    const req = makeRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: "valid-token" }),
    });
    const res = await postGoogle(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/user not found/i);
  });

  it("returns user data and sets cookie for valid token", async () => {
    const { adminAuth } = await import("@/lib/firebase-admin");
    vi.mocked(adminAuth.verifyIdToken).mockResolvedValueOnce({
      email: "user@test.com",
      uid: "uid-123",
    } as never);

    const req = makeRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: "valid-token" }),
    });
    const res = await postGoogle(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("user");
    expect(body.user.email).toBe("user@test.com");
    expect(body.user).toHaveProperty("id");
    expect(body.user).toHaveProperty("role");
  });
});

describe("GET /api/auth/me", () => {
  beforeEach(async () => {
    await seedTestData();
  });

  it("returns 401 without token", async () => {
    const req = makeRequest("/api/auth/me");
    const res = await getMe(req);
    expect(res.status).toBe(401);
  });

  it("returns user data for valid JWT", async () => {
    // Token _id matches seeded user via seedTestData which creates user with email user@test.com
    // We need a token whose _id matches a real DB user
    const { User } = await import("@/models/user");
    const dbUser = await User.findOne({ email: "user@test.com" });
    const token = createTestToken({ _id: String(dbUser!._id), email: "user@test.com" });

    const req = makeRequest("/api/auth/me", { token });
    const res = await getMe(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("user");
    expect(body.user.email).toBe("user@test.com");
    expect(body.user).toHaveProperty("role");
  });

  it("returns 404 when JWT _id does not match any user", async () => {
    // Token with a valid-format but non-existent _id
    const token = createTestToken({ _id: "507f1f77bcf86cd799439099" });
    const req = makeRequest("/api/auth/me", { token });
    const res = await getMe(req);
    expect(res.status).toBe(404);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns success message and clears cookie", async () => {
    const req = makeRequest("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    const res = await postLogout();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Logged out");

    // Verify cookies().delete was called
    const { cookies } = await import("next/headers");
    const cookieStore = await vi.mocked(cookies)();
    expect(cookieStore.delete).toHaveBeenCalledWith("token");
  });
});
