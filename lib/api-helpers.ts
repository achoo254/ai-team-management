import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "./mongoose";
import { getAuthUser, type JwtPayload } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Connect DB + require authenticated user */
export async function withAuth(request: NextRequest): Promise<JwtPayload> {
  await connectDb();
  const user = await getAuthUser(request);
  if (!user) throw new ApiError(401, "Authentication required");
  return user;
}

/** Connect DB + require admin user */
export async function withAdmin(request: NextRequest): Promise<JwtPayload> {
  const user = await withAuth(request);
  if (user.role !== "admin") throw new ApiError(403, "Admin access required");
  return user;
}

/** Connect DB only (no auth required) */
export async function withDb() {
  await connectDb();
}

/** Standard error response handler */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  // Mongoose duplicate key
  if (typeof error === "object" && error !== null && "code" in error && (error as { code: number }).code === 11000) {
    return NextResponse.json({ error: "Đã tồn tại" }, { status: 409 });
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  console.error("[API Error]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}
