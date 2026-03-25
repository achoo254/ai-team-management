import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { config } from "./config";

export interface JwtPayload {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  team: "dev" | "mkt";
}

/** Extract JWT token from cookie or Authorization header */
function getToken(request: NextRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Try cookie
  const tokenCookie = request.cookies.get("token");
  return tokenCookie?.value ?? null;
}

/** Get authenticated user from request, or null */
export async function getAuthUser(request: NextRequest): Promise<JwtPayload | null> {
  const token = getToken(request);
  if (!token) return null;

  try {
    return jwt.verify(token, config.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

/** Get authenticated user or throw 401 */
export async function requireAuth(request: NextRequest): Promise<JwtPayload> {
  const user = await getAuthUser(request);
  if (!user) throw new AuthError("Authentication required", 401);
  return user;
}

/** Get admin user or throw 403 */
export async function requireAdmin(request: NextRequest): Promise<JwtPayload> {
  const user = await requireAuth(request);
  if (user.role !== "admin") throw new AuthError("Admin access required", 403);
  return user;
}

/** Sign a JWT token */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "24h" });
}

/** Set JWT cookie via next/headers */
export async function setTokenCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 86400, // 24h
    path: "/",
  });
}

/** Validate MongoDB ObjectId */
export function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

/** Custom auth error with status code */
export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
