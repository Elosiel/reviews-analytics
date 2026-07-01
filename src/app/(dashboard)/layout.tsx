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
      {children}
    </DashboardShell>
  );
}
