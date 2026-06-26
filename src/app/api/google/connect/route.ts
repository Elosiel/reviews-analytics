import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGoogleAuthUrl } from "@/lib/google/oauth";
import { randomBytes } from "crypto";

// Initiates the Google Business Profile OAuth flow.
// Generates a CSRF state token, stores it in the session, then redirects to Google.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login`
    );
  }

  // Generate a CSRF state token to verify the callback is legitimate
  const state = randomBytes(16).toString("hex");

  // Store state in Supabase session metadata so we can verify in the callback
  await supabase.auth.updateUser({
    data: { google_oauth_state: state },
  });

  const authUrl = getGoogleAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
