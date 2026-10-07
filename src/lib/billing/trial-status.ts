import type { SupabaseClient } from "@supabase/supabase-js";
import {
  locationTrial,
  standardTrialEndsAt,
  type AccountTrial,
  type LocationTrial,
  type TrialExtension,
  type TrialLocation,
} from "@/lib/billing/trial";

export interface TrialStatus {
  account: AccountTrial;
  /** Keyed by locations.id. */
  locations: Record<string, LocationTrial>;
}

/**
 * The persisted trial dates for one restaurant account, resolved per
 * location. This is what a future paywall should call — never derive trial
 * dates from names or from when a location was added.
 *
 * Works with the RLS-scoped session client (users can read, not write, their
 * own account's trial rows) or the service client.
 */
export async function getTrialStatus(
  supabase: SupabaseClient,
  tenantId: string,
  locations: (TrialLocation & { id: string })[]
): Promise<TrialStatus | null> {
  const [{ data: trialRow }, { data: extRows }] = await Promise.all([
    supabase
      .from("tenant_trials")
      .select("trial_started_at, trial_ends_at")
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    supabase.from("trial_extensions").select("google_location_id, trial_ends_at").eq("tenant_id", tenantId),
  ]);

  let account: AccountTrial | null = trialRow
    ? { tenantId, trialStartedAt: trialRow.trial_started_at, trialEndsAt: trialRow.trial_ends_at }
    : null;

  if (!account) {
    // Every account gets a row at signup. The one way to lack one is a
    // teammate removed into a fresh account — their trial still counts from
    // their own original signup, never from now.
    const { data: firstMember } = await supabase
      .from("profiles")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (!firstMember) return null;
    account = {
      tenantId,
      trialStartedAt: firstMember.created_at,
      trialEndsAt: standardTrialEndsAt(firstMember.created_at),
    };
  }

  const extensions: TrialExtension[] = (extRows ?? []).map((e) => ({
    tenantId,
    googleLocationId: e.google_location_id,
    trialEndsAt: e.trial_ends_at,
  }));

  const now = Date.now();
  return {
    account,
    locations: Object.fromEntries(locations.map((l) => [l.id, locationTrial(l, account, extensions, now)])),
  };
}
