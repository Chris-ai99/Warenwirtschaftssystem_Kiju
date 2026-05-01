import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "kiju_session";
const publicPaths = ["/login", "/api/auth/login", "/api/health", "/manifest.webmanifest", "/sw.js"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon-")
  ) {
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api") && !request.cookies.get(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"],
};
