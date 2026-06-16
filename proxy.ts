/**
 * proxy.ts
 * Route protection using Supabase SSR session checking.
 *
 * Rules:
 *   /dashboard/* → redirect to /login if not authenticated
 *   /admin/*     → redirect to /    if not authenticated
 *                  (role check happens inside the admin layout via requireAdmin())
 *
 * This checks session existence and blocks suspended profiles from protected
 * areas. Admin role checks still run in the admin layout/server helpers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect these two route prefixes.
  const isDashboard = pathname.startsWith('/dashboard');
  const isAdmin     = pathname.startsWith('/admin');

  if (!isDashboard && !isAdmin) {
    return NextResponse.next();
  }

  // Build a response that we can attach cookie mutations to.
  const res = NextResponse.next();

  // Create a Supabase client that can read/refresh the session from cookies.
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
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() is safe in middleware/proxy — it validates the JWT without a DB round-trip.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Not authenticated → redirect to login for both /dashboard and /admin.
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('status')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.status === 'suspended') {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('suspended', '1');
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated. For /admin, the layout calls requireAdmin() which does the
  // role check and redirects to '/' if the user is not an admin.
  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
