"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/team/membership";

// Deletes a tracked location. RLS (auth_tenant_id()) scopes this to the
// caller's own tenant — cascades through reviews, review_analyses,
// review_categories, category_rollups, and drift_alerts automatically.
export async function deleteLocation(formData: FormData) {
  const locationId = formData.get("location_id");
  if (typeof locationId !== "string" || !locationId) return;

  const supabase = await createClient();
  const me = await getMembership(supabase);
  // Owners only — also enforced by the "owners delete locations" RLS policy.
  if (!me || me.role !== "owner") return;

  await supabase.from("locations").delete().eq("id", locationId);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/locations");
}
