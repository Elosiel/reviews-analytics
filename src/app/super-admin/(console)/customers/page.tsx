import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { filterCustomers, getCustomerSummaries, PAGE_SIZE } from "@/lib/admin/data";
import { HEALTH_LABELS } from "@/lib/admin/health";
import {
  Badge,
  Empty,
  HealthBadge,
  PageHeader,
  Pagination,
  Table,
  TrialBadge,
  buttonClass,
  fmtDate,
  inputClass,
  pageParam,
  secondaryButtonClass,
  strParam,
  td,
  th,
  timeAgo,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const f = {
    q: strParam(sp.q),
    trial: strParam(sp.trial),
    health: strParam(sp.health),
    activity: strParam(sp.activity),
    internal: strParam(sp.internal),
    sort: strParam(sp.sort) ?? "newest",
  };
  const page = pageParam(sp.page);
  const rows = filterCustomers(await getCustomerSummaries(admin), f);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const exportQs = new URLSearchParams(Object.entries({ kind: "customers", ...f }).filter(([, v]) => v) as [string, string][]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Customers"
        subtitle="Restaurant accounts (organizations). Each row is one account with all its users and locations."
        actions={
          <a href={`/api/super-admin/export?${exportQs}`} className={secondaryButtonClass}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export CSV
          </a>
        }
      />

      <form className="mb-4 flex flex-wrap items-center gap-2" role="search">
        <input name="q" defaultValue={f.q} placeholder="Search name, email, location…" className={`${inputClass} w-64`} aria-label="Search customers" />
        <select name="trial" defaultValue={f.trial ?? "all"} className={inputClass} aria-label="Trial status">
          <option value="all">Any trial status</option>
          <option value="active">On trial</option>
          <option value="expiring">Ending ≤7 days</option>
          <option value="expired">Trial ended</option>
          <option value="paid">Paid</option>
        </select>
        <select name="health" defaultValue={f.health ?? "all"} className={inputClass} aria-label="Health">
          <option value="all">Any health</option>
          {Object.entries(HEALTH_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="activity" defaultValue={f.activity ?? ""} className={inputClass} aria-label="Activity">
          <option value="">Any activity</option>
          <option value="active7">Active in 7 days</option>
          <option value="inactive14">Inactive 14+ days</option>
        </select>
        <select name="sort" defaultValue={f.sort} className={inputClass} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="most_active">Most active</option>
          <option value="least_active">Least active</option>
          <option value="trial_ending">Trial ending soonest</option>
          <option value="recent_login">Recently signed in</option>
          <option value="recent_feedback">Recent feedback</option>
          <option value="locations">Most locations</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-600">
          <input type="checkbox" name="internal" value="include" defaultChecked={f.internal === "include"} />
          Include internal
        </label>
        <button className={buttonClass}>Apply</button>
        {(f.q || f.trial || f.health || f.activity || f.internal) && (
          <Link href="/super-admin/customers" className="text-xs text-zinc-500 hover:text-zinc-900">Clear</Link>
        )}
      </form>

      <Table>
        <thead>
          <tr>
            <th className={th}>Account</th>
            <th className={th}>Health</th>
            <th className={th}>Trial</th>
            <th className={th}>Locations</th>
            <th className={th}>Users</th>
            <th className={th}>Reviews</th>
            <th className={th}>Last active</th>
            <th className={th}>Signed up</th>
            <th className={th}>Feedback</th>
          </tr>
        </thead>
        <tbody>
          {pageRows.map((c) => (
            <tr key={c.tenantId} className="hover:bg-zinc-50/70">
              <td className={td}>
                <Link href={`/super-admin/customers/${c.tenantId}`} className="font-medium text-zinc-950 hover:underline">
                  {c.orgName}
                </Link>
                <p className="text-xs text-zinc-500">{c.ownerEmail}</p>
                {c.isInternal && <Badge tone="dark">internal</Badge>}
              </td>
              <td className={td}><HealthBadge status={c.health} title={c.healthReasons.join(" · ")} /></td>
              <td className={td}><TrialBadge state={c.trial} daysLeft={c.trialDaysLeft} /></td>
              <td className={`${td} tabular-nums`}>
                {c.locationCount}
                {c.brokenLocationCount > 0 && <span className="ml-1 text-xs text-red-600">({c.brokenLocationCount} broken)</span>}
              </td>
              <td className={`${td} tabular-nums`}>{c.memberCount}</td>
              <td className={`${td} tabular-nums`}>
                {c.analyzedCount.toLocaleString()}
                <span className="text-xs text-zinc-400"> / {c.reviewCount.toLocaleString()}</span>
              </td>
              <td className={td}>{timeAgo(c.lastActivityAt)}</td>
              <td className={td}>{fmtDate(c.createdAt)}</td>
              <td className={td}>
                {c.openFeedback > 0 ? <Badge tone={c.openBugs ? "red" : "teal"}>{`${c.openFeedback} open`}</Badge> : <span className="text-xs text-zinc-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length === 0 && <Empty>No customers match these filters.</Empty>}
      <Pagination page={page} total={rows.length} pageSize={PAGE_SIZE} basePath="/super-admin/customers" params={f} />
    </div>
  );
}
