import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. For internal batch/cron
 * jobs that operate across every tenant (review analysis, rollup
 * compute, sync, digest), not for anything driven by a single user's
 * own request. Never expose this client or its key to the browser.
 */
export function createServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}
