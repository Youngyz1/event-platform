/**
 * proxy.ts
 *
 * Global Supabase SSR proxy for:
 * - Session refresh on every request
 * - Protected route enforcement
 * - Suspended account blocking
 * - Admin role verification for `/admin/*` (sets `x-admin-verified` on the
 *   forwarded request so `app/admin/layout.tsx` can skip its own redundant
 *   Supabase round-trip on the common path — see `requireAdmin()` in
 *   lib/auth.ts, which still runs in full as a fallback if this header is
 *   ever absent, preserving the three-layer defense-in-depth described there)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/create-event") ||
    pathname.startsWith("/create-fundraiser") ||
    pathname.startsWith("/create-organizer");
  const isAdminPath = pathname.startsWith("/admin");

  // Response object that Supabase can attach refreshed cookies to. Kept
  // separate from the final returned response so an admin-verified request
  // can be re-issued below with an extra request header (cookies set here
  // are copied onto that final response before returning).
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() validates the JWT and refreshes tokens when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protected routes require authentication.
  if (isProtected && !user) {
    const loginUrl = req.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirect", pathname);

    return NextResponse.redirect(loginUrl);
  }

  // Redirect already-authenticated users away from login/signup.
  if ((pathname === "/login" || pathname === "/signup") && user) {
    const homeUrl = req.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  // Block suspended accounts from protected areas. Also fetches `role` here
  // (same query, no extra round-trip) so admin paths can be gated below.
  let isVerifiedAdmin = false;

  if (isProtected && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.status === "suspended") {
      const loginUrl = req.nextUrl.clone();

      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("suspended", "1");

      return NextResponse.redirect(loginUrl);
    }

    /**
     * Accounts in the deletion lifecycle.
     *
     * `purged` is the terminal state: the grace period elapsed, so there is no
     * way back and the account must behave as gone. The row and its data are
     * retained for fraud and dispute investigation, so nothing about that is
     * enforced in the database — this check IS the enforcement. Without it a
     * purged user could still sign in and use the dashboard normally.
     *
     * `pending_deletion` is bounced too, but to the recovery page rather than a
     * dead end: they are inside the 14-day window and self-cancelling is the
     * whole point of it.
     */
    if (profile?.status === "purged") {
      const loginUrl = req.nextUrl.clone();

      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("deleted", "1");

      return NextResponse.redirect(loginUrl);
    }

    if (profile?.status === "pending_deletion") {
      const recoverUrl = req.nextUrl.clone();

      recoverUrl.pathname = "/recover-account";
      recoverUrl.search = "";

      return NextResponse.redirect(recoverUrl);
    }

    if (isAdminPath) {
      if (profile?.role !== "admin") {
        const homeUrl = req.nextUrl.clone();
        homeUrl.pathname = "/";
        homeUrl.search = "";
        return NextResponse.redirect(homeUrl);
      }
      isVerifiedAdmin = true;
    }
  }

  if (isVerifiedAdmin) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-admin-verified", "1");
    const verifiedRes = NextResponse.next({ request: { headers: requestHeaders } });
    for (const cookie of res.cookies.getAll()) {
      verifiedRes.cookies.set(cookie);
    }
    return verifiedRes;
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/create-event/:path*",
    "/create-fundraiser/:path*",
    "/create-organizer/:path*",
    "/login",
    "/signup",
  ],
};
