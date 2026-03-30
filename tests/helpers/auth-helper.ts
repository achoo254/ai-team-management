import jwt from "jsonwebtoken";
import type { JwtPayload } from "@/lib/auth";

const TEST_SECRET = "test-secret-for-vitest";

/** Create admin JWT token for test requests */
export function createTestToken(overrides?: Partial<JwtPayload>): string {
  const payload: JwtPayload = {
    _id: "507f1f77bcf86cd799439011",
    name: "Test Admin",
    email: "admin@test.com",
    role: "admin",
    team: "dev",
    ...overrides,
  };
  return jwt.sign(payload, TEST_SECRET, { expiresIn: "1h" });
}

/** Create non-admin user JWT token */
export function createUserToken(overrides?: Partial<JwtPayload>): string {
  return createTestToken({
    role: "user",
    name: "Test User",
    email: "user@test.com",
    ...overrides,
  });
}
