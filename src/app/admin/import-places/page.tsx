/**
 * TEMPORARY — operator-only tool to seed a design-partner account with real
 * review data via the Places API while GBP read access is pending
 * (CLAUDE.md "Critical-Path Gates" #1). Not linked from any tenant-facing
 * nav; reach it directly at /admin/import-places.
 *
 * Delete this page (and its API routes under /api/admin, plus
 * /api/reviews/import-places, places-import.ts, places-reviews.ts) once
 * /api/reviews/sync (GBP) is live for real tenants.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlacesImportTool from "@/components/admin/PlacesImportTool";

export default async function ImportPlacesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "operator") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Temporary bridge.</strong> This pulls up to ~5 recent
          reviews per location via the Google Places API — not the full
          history GBP will give us once approved. Good for demos and for
          exercising the pipeline; don&apos;t present it to a customer as
          complete review coverage.
        </div>
        <PlacesImportTool />
      </div>
    </div>
  );
}
