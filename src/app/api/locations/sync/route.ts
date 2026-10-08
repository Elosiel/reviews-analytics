import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { listAccounts, listLocations } from "@/lib/google/business-profile";
import { getValidAccessToken } from "@/lib/pipeline/tokens";
import { describeGoogleError } from "@/lib/google/errors";
import { canAddLocations, getMembership } from "@/lib/team/membership";
import { recordEvent } from "@/lib/telemetry/server";

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

  try {
    // Refreshes the stored token if it's near expiry; throws GoogleReauthError
    // if there's no token or Google refuses the refresh.
    const accessToken = await getValidAccessToken(createServiceClient(), user.id);

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

    // Mark locations this tenant already tracks so a reconnect starts with
    // them selected (RLS scopes this read to the caller's own tenant).
    const { data: trackedRows } = await supabase
      .from("locations")
      .select("google_location_id")
      .in("google_location_id", locations.map((l) => l.google_location_id));
    const tracked = new Set((trackedRows ?? []).map((r) => r.google_location_id));

    // account_count lets onboarding tell "this Google user manages no
    // Business Profiles" apart from "profiles exist but have no locations".
    return NextResponse.json({
      locations: locations.map((l) => ({ ...l, tracked: tracked.has(l.google_location_id) })),
      account_count: accounts.length,
    });
  } catch (err) {
    console.error("Location sync error:", err);
    const info = describeGoogleError(err);
    return NextResponse.json({ error: info.message, kind: info.kind }, { status: 502 });
  }
}

// POST — save selected locations to the database
// Body: { locations: GBPLocation[] }
export async function POST(request: Request) {
  const supabase = await createClient();
  const me = await getMembership(supabase);
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = canAddLocations(me);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.reason }, { status: 403 });
  }
  const user = me.user;
  const profile = { tenant_id: me.tenantId };

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

  await recordEvent({ type: "location_added", tenantId: profile.tenant_id, userId: user.id, metadata: { count: rows.length } });
  return NextResponse.json({ saved: rows.length });
}
