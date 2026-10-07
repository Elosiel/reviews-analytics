import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/auth";

// An organization is a restaurant account — the Customers view.
export default async function OrganizationsPage() {
  await requireAdminPage();
  redirect("/super-admin/customers");
}
