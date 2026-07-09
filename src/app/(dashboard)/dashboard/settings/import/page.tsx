/**
 * TEMPORARY — self-service bridge so a signed-in tenant can pull real
 * reviews via the Google Places API while GBP read access is pending
 * (CLAUDE.md "Critical-Path Gates" #1). Delete alongside the rest of the
 * bridge (see src/app/api/reviews/import-places/route.ts) once
 * /api/reviews/sync is live for real tenants.
 */

import ImportReviewsSearch from "@/components/dashboard/ImportReviewsSearch";

export default function ImportReviewsPage() {
  return (
    <div className="px-6 py-10 max-w-2xl mx-auto space-y-7">
      <ImportReviewsSearch />
    </div>
  );
}
