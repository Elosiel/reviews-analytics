import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/team/invite-shared";

// Supabase Auth callback — handles the OAuth code exchange after Google sign-in.
// After this, the user session is set and we redirect to onboarding or dashboard.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // An explicit destination (e.g. a team invite) wins over the onboarding
  // check — an invited teammate has no locations until they accept.
  const explicitNext = safeNextPath(searchParams.get("next"));
  const next = explicitNext ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && explicitNext) {
      return NextResponse.redirect(`${origin}${explicitNext}`);
    }

    if (!error) {
      // Check if this user has any connected locations yet.
      // If not, send them to onboarding.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { count } = await supabase
          .from("locations")
          .select("*", { count: "exact", head: true });

        if (!count || count === 0) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth failed — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
