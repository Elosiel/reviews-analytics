import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/team/invite-shared";
import {
  IMP_META_COOKIE,
  impersonationBlocksRequest,
  impersonationExpired,
  parseImpersonationMeta,
} from "@/lib/admin/impersonation-shared";

const END_IMPERSONATION = "/api/super-admin/impersonation/end";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Cross-site write guard ──
  // Browsers send Origin on every POST/PATCH/DELETE. A write to our API
  // from another site is refused outright (server-to-server callers like
  // pg_cron send no Origin and are unaffected).
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = origin ? new URL(origin).host : null;
    } catch {
      originHost = "invalid";
    }
    if (originHost && host && originHost !== host) {
      return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });
    }
  }

  // ── Impersonation guard (runs before anything else, API routes included) ──
  // A Super Admin viewing a customer account is read-only and time-boxed.
  const imp = parseImpersonationMeta(request.cookies.get(IMP_META_COOKIE)?.value);
  if (imp && !pathname.startsWith(END_IMPERSONATION)) {
    const isApi = pathname.startsWith("/api/");
    // Expired, or heading back into the admin console: end it (restores the admin's own session).
    if (impersonationExpired(imp) || pathname.startsWith("/super-admin")) {
      if (isApi) return NextResponse.json({ error: "Impersonation session ended" }, { status: 401 });
      const url = new URL(END_IMPERSONATION, request.url);
      url.searchParams.set("reason", impersonationExpired(imp) ? "expired" : "exited");
      return NextResponse.redirect(url);
    }
    if (impersonationBlocksRequest(request.method, pathname)) {
      return NextResponse.json(
        { error: "Read-only: you're viewing this account as a Reviews Analytics admin. Exit impersonation to make changes." },
        { status: 403 }
      );
    }
  }
  // API routes do their own auth; the middleware only applied the guard above.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // Deployment not configured yet — show setup instructions instead of a 500
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.redirect(new URL("/setup-required", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated: protect dashboard and onboarding
  if (!user && (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin console: signed-out visitors go to the admin sign-in. Role and
  // two-factor are verified server-side in the console layout and every
  // /api/super-admin route — never here alone.
  if (!user && pathname.startsWith("/super-admin") && pathname !== "/super-admin/login") {
    return NextResponse.redirect(new URL("/super-admin/login", request.url));
  }

  // Authenticated: redirect away from login/signup (to ?next= if it's a same-site path)
  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get("next")) ?? "/dashboard", request.url));
  }

  // Sign-up used to be a mode of /login — keep old links (and their ?next=/
  // ?email=) working by forwarding them to /signup.
  if (pathname === "/login" && request.nextUrl.searchParams.get("mode") === "signup") {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.searchParams.delete("mode");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/onboarding",
    "/login",
    "/signup",
    "/invite/:path*",
    "/super-admin",
    "/super-admin/:path*",
    "/api/:path*",
  ],
};
