import { createClient } from "@/lib/supabase/server";
import { MOCK_REPORTS } from "@/lib/mock-data";
import type { WeeklyReport } from "@/types";
import ReportsPageClient from "@/components/dashboard/ReportsPageClient";

export default async function ReportsPage() {
  const supabase = await createClient();

  // Same demo-mode rule as the rest of the dashboard: real locations →
  // real data; none yet → the Miami mock walkthrough.
  const { data: locations } = await supabase.from("locations").select("*").order("name");

  if (!locations?.length) {
    return <ReportsPageClient initialReports={MOCK_REPORTS} demo />;
  }

  const { data: reports } = await supabase
    .from("weekly_reports")
    .select("*")
    .order("generated_at", { ascending: false });

  return (
    <ReportsPageClient
      initialReports={(reports ?? []) as WeeklyReport[]}
      demo={false}
    />
  );
}
