import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { emailsFor, getCustomerSummaries, listEvents, listUsers } from "@/lib/admin/data";
import { createServiceClient } from "@/lib/supabase/service";
import { Card, HealthBadge, PageHeader, StatCard, TrialBadge, timeAgo, Badge, FEEDBACK_TYPE_LABELS } from "@/components/admin/ui";
import { describeEvent } from "@/lib/admin/events";

export const dynamic = "force-dynamic";

const DAY = 864e5;
const nowMs = () => Date.now();
const daysAgoIso = (d: number) => new Date(nowMs() - d * DAY).toISOString();

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const admin = await requireAdminPage();
  const { denied } = await searchParams;
  const service = createServiceClient();

  const [all, events, users, { data: openFb }, { data: ratings }, { data: activeUserRows }] = await Promise.all([
    getCustomerSummaries(admin),
    listEvents(admin, { pageSize: 15 }),
    listUsers(admin, { pageSize: 200 }),
    service.from("feedback").select("type").in("status", ["new", "in_review"]).limit(2000),
    service.from("feedback").select("rating, created_at, subject, id").not("rating", "is", null).order("created_at", { ascending: false }).limit(200),
    service.from("product_events").select("user_id").is("impersonation_session_id", null).gte("created_at", daysAgoIso(7)).limit(10000),
  ]);
  const now = nowMs();
  const customers = all.filter((c) => !c.isInternal);
  const internalCount = all.length - customers.length;
  const within = (iso: string | null, days: number) => !!iso && now - Date.parse(iso) <= days * DAY;

  const activeCustomers = customers.filter((c) => within(c.lastActivityAt, 7)).length;
  const onTrial = customers.filter((c) => c.trial === "active" || c.trial === "expiring");
  const expiring = customers.filter((c) => c.trial === "expiring");
  const expired = customers.filter((c) => c.trial === "expired");
  const attention = customers.filter((c) => ["needs_attention", "connection_issue", "trial_expiring"].includes(c.health));
  const customerTenants = new Set(customers.map((c) => c.tenantId));
  const customerUsers = users.rows.filter((u) => u.tenant_id && customerTenants.has(u.tenant_id) && !u.admin_role);
  const activeUserIds = new Set<string>([
    ...(activeUserRows ?? []).map((r) => r.user_id as string).filter(Boolean),
    ...customerUsers.filter((u) => within(u.last_sign_in_at, 7)).map((u) => u.user_id),
  ]);
  const activeUsers = customerUsers.filter((u) => activeUserIds.has(u.user_id)).length;
  const fbCounts = (openFb ?? []).reduce<Record<string, number>>((m, f) => ({ ...m, [f.type]: (m[f.type] ?? 0) + 1 }), {});
  const rated = ratings ?? [];
  const avgRating = rated.length ? rated.reduce((s, r) => s + (r.rating as number), 0) / rated.length : null;
  const lowRatings = rated.filter((r) => (r.rating as number) <= 2).slice(0, 5);
  const emails = await emailsFor(admin, events.rows.map((e) => e.user_id));
  const orgByTenant = Object.fromEntries(all.map((c) => [c.tenantId, c.orgName]));
  const recentLogins = [...customerUsers].filter((u) => u.last_sign_in_at).sort((a, b) => Date.parse(b.last_sign_in_at!) - Date.parse(a.last_sign_in_at!)).slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Overview"
        subtitle={`Customer metrics exclude ${internalCount} internal/test account${internalCount === 1 ? "" : "s"} (mark accounts internal from their customer page).`}
      />
      {denied && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">Your admin role doesn&apos;t include that action.</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Customers" value={customers.length} href="/super-admin/customers" />
        <StatCard label="Active (7d)" value={activeCustomers} hint="signed in or used the app" />
        <StatCard label="New signups" value={customers.filter((c) => within(c.createdAt, 7)).length} hint={`${customers.filter((c) => within(c.createdAt, 30)).length} in 30 days`} />
        <StatCard label="On trial" value={onTrial.length} href="/super-admin/customers?trial=active" />
        <StatCard label="Trials ending ≤7d" value={expiring.length} tone={expiring.length ? "warn" : "default"} href="/super-admin/customers?trial=expiring" />
        <StatCard label="Trials ended" value={expired.length} tone={expired.length ? "bad" : "default"} href="/super-admin/customers?trial=expired" />
        <StatCard label="Paid customers" value="—" tone="muted" hint="Billing isn't connected yet" />
        <StatCard label="Users" value={customerUsers.length} hint={`${activeUsers} active in 7 days`} href="/super-admin/users" />
        <StatCard label="Locations" value={customers.reduce((s, c) => s + c.locationCount, 0)} href="/super-admin/locations" />
        <StatCard
          label="Google-connected"
          value={customers.reduce((s, c) => s + c.gbpLocationCount - c.brokenLocationCount, 0)}
          hint={`${customers.reduce((s, c) => s + c.brokenLocationCount, 0)} broken`}
        />
        <StatCard label="Reviews analyzed" value={customers.reduce((s, c) => s + c.analyzedCount, 0).toLocaleString()} hint={`${customers.reduce((s, c) => s + c.reviewCount, 0).toLocaleString()} imported`} />
        <StatCard
          label="Experience rating"
          value={avgRating ? `${avgRating.toFixed(1)} / 5` : "—"}
          tone={avgRating ? "default" : "muted"}
          hint={rated.length ? `${rated.length} rating${rated.length === 1 ? "" : "s"}` : "No ratings yet"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Open feedback" value={(openFb ?? []).length} href="/super-admin/feedback?status=open" />
        <StatCard label="Open bugs" value={fbCounts.bug ?? 0} tone={fbCounts.bug ? "bad" : "default"} href="/super-admin/feedback?status=open&type=bug" />
        <StatCard label="Feature requests" value={(fbCounts.feature ?? 0) + (fbCounts.improvement ?? 0)} href="/super-admin/feedback?status=open&type=feature" />
        <StatCard label="Needs help" value={fbCounts.support ?? 0} tone={fbCounts.support ? "warn" : "default"} href="/super-admin/feedback?status=open&type=support" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Customers needing attention (${attention.length})`} actions={<Link href="/super-admin/customers?health=needs_attention" className="text-xs text-zinc-500 hover:text-zinc-900">View all</Link>}>
          {attention.length === 0 ? (
            <p className="text-sm text-zinc-500">Nobody right now.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {attention.slice(0, 8).map((c) => (
                <li key={c.tenantId} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link href={`/super-admin/customers/${c.tenantId}`} className="block truncate text-sm font-medium text-zinc-900 hover:underline">
                      {c.orgName}
                    </Link>
                    <p className="truncate text-xs text-zinc-500">{c.healthReasons.join(" · ")}</p>
                  </div>
                  <HealthBadge status={c.health} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Trials ending soon">
          {expiring.length === 0 && onTrial.length === 0 ? (
            <p className="text-sm text-zinc-500">No active trials.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {[...onTrial]
                .sort((a, b) => Date.parse(a.effectiveTrialEndsAt!) - Date.parse(b.effectiveTrialEndsAt!))
                .slice(0, 8)
                .map((c) => (
                  <li key={c.tenantId} className="flex items-center justify-between gap-3 py-2.5">
                    <Link href={`/super-admin/customers/${c.tenantId}`} className="truncate text-sm font-medium text-zinc-900 hover:underline">
                      {c.orgName}
                    </Link>
                    <TrialBadge state={c.trial} daysLeft={c.trialDaysLeft} />
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card title="Recent customer activity" actions={<Link href="/super-admin/activity" className="text-xs text-zinc-500 hover:text-zinc-900">View all</Link>}>
          {events.rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No activity recorded yet. Tracking starts with this release.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {events.rows.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="truncate text-zinc-800">
                      {describeEvent(e)}
                      {e.impersonation_session_id && <span className="ml-1.5"><Badge tone="violet">admin view</Badge></span>}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {(e.user_id && emails[e.user_id]) || "—"} · {(e.tenant_id && orgByTenant[e.tenant_id]) || "—"}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">{timeAgo(e.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Recent sign-ins">
            {recentLogins.length === 0 ? (
              <p className="text-sm text-zinc-500">No sign-ins yet.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {recentLogins.map((u) => (
                  <li key={u.user_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate text-zinc-800">{u.email}</span>
                    <span className="shrink-0 text-xs text-zinc-400">{timeAgo(u.last_sign_in_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-zinc-400">From Supabase Auth. An admin &ldquo;view as&rdquo; session also counts as a sign-in there; those are marked separately in Activity.</p>
          </Card>
          <Card title="Low ratings to follow up">
            {lowRatings.length === 0 ? (
              <p className="text-sm text-zinc-500">None.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {lowRatings.map((r) => (
                  <li key={r.id as string} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link href={`/super-admin/feedback/${r.id}`} className="truncate text-zinc-800 hover:underline">{r.subject as string}</Link>
                    <Badge tone="red">{`${r.rating}/5`}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <p className="text-[11px] text-zinc-400">
        Feedback types: {Object.entries(FEEDBACK_TYPE_LABELS).map(([k, v]) => `${v} ${fbCounts[k] ?? 0}`).join(" · ")} (open)
      </p>
    </div>
  );
}
