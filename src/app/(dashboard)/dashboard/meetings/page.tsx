import { createClient } from "@/lib/supabase/server";
import { MOCK_LOCATIONS, MOCK_MEETINGS, MOCK_SOPS } from "@/lib/mock-data";
import type { Location, Sop } from "@/types";
import MeetingsPageClient, { rowToMeeting } from "@/components/dashboard/MeetingsPageClient";

export default async function MeetingsPage() {
  const supabase = await createClient();

  // Same demo-mode rule as the rest of the dashboard: real locations →
  // real data; none yet → the Miami mock walkthrough.
  const { data: locations } = await supabase.from("locations").select("*").order("name");

  if (!locations?.length) {
    return (
      <MeetingsPageClient
        locations={MOCK_LOCATIONS}
        initialMeetings={MOCK_MEETINGS}
        sops={MOCK_SOPS}
        demo
      />
    );
  }

  const [{ data: meetingRows }, { data: sops }] = await Promise.all([
    supabase.from("meetings").select("*").order("generated_at", { ascending: false }),
    supabase.from("sops").select("*"),
  ]);

  return (
    <MeetingsPageClient
      locations={locations as Location[]}
      initialMeetings={(meetingRows ?? []).map(rowToMeeting)}
      sops={(sops ?? []) as Sop[]}
      demo={false}
    />
  );
}
