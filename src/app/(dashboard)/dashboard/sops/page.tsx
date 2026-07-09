import { createClient } from "@/lib/supabase/server";
import { MOCK_SOPS, MOCK_SOP_EVIDENCE, MOCK_DRIFT_ALERTS } from "@/lib/mock-data";
import type { DriftAlert, Sop } from "@/types";
import SopsPageClient from "@/components/dashboard/SopsPageClient";

export default async function SopsPage() {
  const supabase = await createClient();

  // Same demo-mode rule as the rest of the dashboard: real locations →
  // real data; none yet → the Miami mock walkthrough.
  const { count: locationCount } = await supabase
    .from("locations")
    .select("*", { count: "exact", head: true });

  if (!locationCount) {
    return (
      <SopsPageClient
        initialSops={MOCK_SOPS}
        evidence={MOCK_SOP_EVIDENCE}
        driftAlerts={MOCK_DRIFT_ALERTS}
        demo
      />
    );
  }

  const [{ data: sops }, { data: quotes }, { data: alerts }] = await Promise.all([
    supabase.from("sops").select("*").order("updated_at", { ascending: false }),
    supabase
      .from("sop_evidence_quotes")
      .select("sop_id, location_name, quote_text")
      .not("quote_text", "is", null),
    supabase.from("drift_alerts").select("*").eq("resolved", false),
  ]);

  const evidence: Record<string, { location_name: string; quote: string }[]> = {};
  for (const q of quotes ?? []) {
    if (!evidence[q.sop_id]) evidence[q.sop_id] = [];
    evidence[q.sop_id].push({ location_name: q.location_name, quote: q.quote_text! });
  }

  return (
    <SopsPageClient
      initialSops={(sops ?? []) as Sop[]}
      evidence={evidence}
      driftAlerts={(alerts ?? []) as DriftAlert[]}
      demo={false}
    />
  );
}
