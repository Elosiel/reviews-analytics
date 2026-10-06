import type { SupabaseClient, User } from "@supabase/supabase-js";

export type TeamRole = "owner" | "member";

export interface Membership {
  user: User;
  tenantId: string;
  role: TeamRole;
}

/**
 * Who the signed-in user is within their restaurant account. Reads only the
 * caller's own profile row (RLS-scoped session client). null when signed out
 * or the profile is missing.
 */
export async function getMembership(supabase: SupabaseClient): Promise<Membership | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, team_role")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return { user, tenantId: profile.tenant_id, role: profile.team_role === "member" ? "member" : "owner" };
}

export const OWNER_ONLY_MESSAGE = "Only the account owner can do this. Ask them to make the change.";

/**
 * The single checkpoint for adding locations. Today: owners only. When
 * per-location billing lands, the plan/seat check goes here too.
 */
export function canAddLocations(m: Membership): { ok: true } | { ok: false; reason: string } {
  if (m.role !== "owner") return { ok: false, reason: "Only the account owner can add locations." };
  return { ok: true };
}
