import { NextResponse } from "next/server";
import { audit, requireAdminApi } from "@/lib/admin/auth";
import { filterCustomers, getCustomerSummaries, listFeedback, listUsers } from "@/lib/admin/data";
import { toCsv } from "@/lib/admin/health";
import { HEALTH_LABELS } from "@/lib/admin/health";

// Operational CSV exports. Columns are an explicit allowlist: no passwords,
// tokens, secrets or review text ever appear.
export async function GET(request: Request) {
  const admin = await requireAdminApi("export");
  if (admin instanceof NextResponse) return admin;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind");
  const p = (k: string) => url.searchParams.get(k) ?? undefined;
  let csv: string;
  let rowCount: number;

  if (kind === "customers") {
    const rows = filterCustomers(await getCustomerSummaries(admin), {
      q: p("q"), trial: p("trial"), health: p("health"), activity: p("activity"), internal: p("internal"), sort: p("sort"),
    });
    rowCount = rows.length;
    csv = toCsv(
      rows.map((c) => ({ ...c, health: HEALTH_LABELS[c.health], healthReasons: c.healthReasons.join("; ") })),
      [
        { key: "orgName", header: "Account" },
        { key: "ownerEmail", header: "Owner email" },
        { key: "ownerName", header: "Owner name" },
        { key: "createdAt", header: "Signed up" },
        { key: "health", header: "Health" },
        { key: "healthReasons", header: "Health reasons" },
        { key: "trial", header: "Trial status" },
        { key: "trialStartedAt", header: "Trial start" },
        { key: "trialEndsAt", header: "Account trial end" },
        { key: "extensionEndsAt", header: "Location extension end" },
        { key: "trialDaysLeft", header: "Days left" },
        { key: "locationCount", header: "Locations" },
        { key: "brokenLocationCount", header: "Broken connections" },
        { key: "memberCount", header: "Users" },
        { key: "reviewCount", header: "Reviews imported" },
        { key: "analyzedCount", header: "Reviews analyzed" },
        { key: "lastSignInAt", header: "Last sign-in" },
        { key: "lastActivityAt", header: "Last activity" },
        { key: "openFeedback", header: "Open feedback" },
        { key: "isInternal", header: "Internal" },
      ]
    );
  } else if (kind === "users") {
    const all = [];
    for (let page = 1; page <= 25; page++) {
      const { rows } = await listUsers(admin, { q: p("q"), page, pageSize: 200 });
      all.push(...rows);
      if (rows.length < 200) break;
    }
    rowCount = all.length;
    csv = toCsv(all as unknown as Record<string, unknown>[], [
      { key: "email", header: "Email" },
      { key: "full_name", header: "Name" },
      { key: "tenant_id", header: "Account id" },
      { key: "team_role", header: "Team role" },
      { key: "admin_role", header: "Admin role" },
      { key: "provider", header: "Sign-in method" },
      { key: "created_at", header: "Created" },
      { key: "last_sign_in_at", header: "Last sign-in" },
      { key: "email_confirmed_at", header: "Email confirmed" },
      { key: "banned_until", header: "Disabled until" },
    ]);
  } else if (kind === "feedback") {
    const all = [];
    for (let page = 1; page <= 20; page++) {
      const { rows } = await listFeedback(admin, { status: p("status") ?? "all", type: p("type"), page, pageSize: 500 });
      all.push(...rows);
      if (rows.length < 500) break;
    }
    rowCount = all.length;
    csv = toCsv(all as unknown as Record<string, unknown>[], [
      { key: "created_at", header: "Sent" },
      { key: "type", header: "Type" },
      { key: "status", header: "Status" },
      { key: "priority", header: "Priority" },
      { key: "subject", header: "Subject" },
      { key: "message", header: "Message" },
      { key: "rating", header: "Rating" },
      { key: "user_email", header: "From" },
      { key: "tenant_id", header: "Account id" },
      { key: "route", header: "Page" },
    ]);
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 400 });
  }

  await audit(admin, "export.downloaded", { type: "export", id: kind, details: { rows: rowCount } });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reviews-analytics-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
