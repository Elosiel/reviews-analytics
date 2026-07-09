/**
 * GET /api/admin/lookup-customer?email=...
 *
 * TEMPORARY — operator-only helper for /admin/import-places. Resolves an
 * existing profile (the customer must already have signed in once via
 * /login) to the tenant_id/user_id the Places import needs. Does not
 * create accounts — that still happens through normal Google sign-in.
 *
 * Delete alongside /admin/import-places once GBP sync is live.
 */

import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // Session-bound client — RLS only lets a user read their own profile row,
  // which is exactly enough to check "is this caller an operator?".
  const sessionClient = await createClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await sessionClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "operator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const email = new URL(request.url).searchParams.get("email")?.trim();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  // Cross-tenant lookup by email is deliberately outside what "own profile"
  // RLS allows — bypass it here, now that the caller is confirmed operator.
  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, tenant_id, full_name, email")
    .eq("email", email)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ customer: null });
  }

  const { count: locationCount } = await supabase
    .from("locations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", profile.tenant_id);

  return NextResponse.json({
    customer: {
      user_id: profile.id,
      tenant_id: profile.tenant_id,
      full_name: profile.full_name,
      email: profile.email,
      location_count: locationCount ?? 0,
    },
  });
}
