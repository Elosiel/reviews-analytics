import { createClient } from "@/lib/supabase/client";

/**
 * The logged-in user's tenant id, resolved from their profile row.
 * Browser-side counterpart to the SQL auth_tenant_id() that RLS uses —
 * needed when a client insert must stamp tenant_id (RLS then verifies it).
 */
export async function currentTenantId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();
  return data?.tenant_id ?? null;
}
