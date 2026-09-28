import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardShell from "@/components/layouts/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, tenant_id")
    .eq("id", user.id)
    .single();

  // With no connected locations, every dashboard page falls back to the
  // Miami mock walkthrough. Say so plainly — a new client who hasn't finished
  // connecting Google must never mistake sample numbers for their own.
  const { count: locationCount } = await supabase
    .from("locations")
    .select("*", { count: "exact", head: true });
  const showingSampleData = !locationCount;

  // Count unresolved drift alerts for sidebar badge
  const { count: driftCount } = await supabase
    .from("drift_alerts")
    .select("*", { count: "exact", head: true })
    .eq("resolved", false);

  return (
    <DashboardShell
      user={{
        email: user.email,
        full_name: profile?.full_name ?? undefined,
        avatar_url: profile?.avatar_url ?? undefined,
      }}
      driftAlertCount={driftCount ?? 0}
    >
      {showingSampleData && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
          <strong>You&apos;re viewing sample data</strong> from a demo
          restaurant group — none of these numbers are yours.{" "}
          <a href="/onboarding" className="font-medium underline underline-offset-2">
            Connect Google to see your own reviews →
          </a>
        </div>
      )}
      {children}
    </DashboardShell>
  );
}
