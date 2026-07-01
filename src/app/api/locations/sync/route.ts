import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listAccounts, listLocations } from "@/lib/google/business-profile";
import { decryptToken } from "@/app/api/google/callback/route";

// GET — fetch available locations from Google Business Profile
// Called from onboarding after GBP OAuth completes.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get stored (encrypted) tokens
  const { data: tokenRow } = await supabase
    .from("google_tokens")
    .select("access_token_enc, expires_at")
    .eq("user_id", user.id)
    .single();

  if (!tokenRow) {
    return NextResponse.json(
      { error: "Google account not connected. Please connect first." },
      { status: 400 }
    );
  }

  try {
    const accessToken = decryptToken(
      Buffer.from(tokenRow.access_token_enc).toString()
    );

    // Fetch all accounts then all locations
    const accountsData = await listAccounts(accessToken);
    const accounts: { name: string }[] = accountsData.accounts ?? [];

    const locations: {
      google_location_id: string;
      google_account_id: string;
      name: string;
      address: string;
    }[] = [];

    for (const account of accounts) {
      const locData = await listLocations(accessToken, account.name);
      const locs = locData.locations ?? [];
      for (const loc of locs) {
        const addrParts = loc.storefrontAddress ?? {};
        const address = [
          addrParts.addressLines?.join(", "),
          addrParts.locality,
          addrParts.administrativeArea,
        ]
          .filter(Boolean)
          .join(", ");

        locations.push({
          google_location_id: loc.name,
          google_account_id: account.name,
          name: loc.title ?? "Unnamed Location",
          address,
        });
      }
    }

    return NextResponse.json({ locations });
  } catch (err) {
    console.error("Location sync error:", err);
    return NextResponse.json(
      { error: "Failed to fetch locations from Google." },
      { status: 500 }
    );
  }
}

// POST — save selected locations to the database
// Body: { locations: GBPLocation[] }
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  const body = await request.json();
  const incoming: {
    google_location_id: string;
    google_account_id: string;
    name: string;
    address: string;
  }[] = body.locations ?? [];

  if (incoming.length === 0) {
    return NextResponse.json({ error: "No locations provided" }, { status: 400 });
  }

  const rows = incoming.map((loc) => ({
    tenant_id: profile.tenant_id,
    user_id: user.id,
    google_account_id: loc.google_account_id,
    google_location_id: loc.google_location_id,
    name: loc.name,
    address: loc.address,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("locations")
    .upsert(rows, { onConflict: "tenant_id,google_location_id" });

  if (error) {
    console.error("Location save error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: rows.length });
}
