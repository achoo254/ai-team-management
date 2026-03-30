import { NextRequest } from "next/server";

/** Build a NextRequest for testing API routes */
export function makeRequest(
  path: string,
  options?: RequestInit & { token?: string },
) {
  const { token, ...init } = options || {};
  const url = new URL(path, "http://localhost:3000");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const req = new NextRequest(url, init as any);
  if (token) {
    req.headers.set("authorization", `Bearer ${token}`);
  }
  return req;
}
