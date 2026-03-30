import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;

  // Logged-in user on /login → redirect to dashboard
  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // /login without token → allow through
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // All other protected routes: no token → redirect to login
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on page routes, skip API/static/internal
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
