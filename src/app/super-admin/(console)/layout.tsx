import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin/auth";
import AdminShell from "@/components/admin/AdminShell";

export const metadata: Metadata = {
  title: "Admin console — Reviews Analytics",
  robots: { index: false, follow: false },
};

// Every console page is server-rendered behind this check: verified session
// + active admin_users row + two-factor (aal2). Pages and APIs re-check on
// their own; this layout is not the only gate.
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <AdminShell email={admin.email} role={admin.role}>
      {children}
    </AdminShell>
  );
}
