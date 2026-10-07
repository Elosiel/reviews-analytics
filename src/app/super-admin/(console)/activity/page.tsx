import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { emailsFor, getCustomerSummaries, listEvents, PAGE_SIZE } from "@/lib/admin/data";
import { describeEvent, EVENT_FILTERS } from "@/lib/admin/events";
import { Badge, Empty, PageHeader, Pagination, Table, buttonClass, fmtDateTime, inputClass, pageParam, strParam, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const type = strParam(sp.type);
  const page = pageParam(sp.page);
  const [{ rows, total }, customers] = await Promise.all([listEvents(admin, { type, page }), getCustomerSummaries(admin)]);
  const emails = await emailsFor(admin, rows.map((r) => r.user_id));
  const orgs = Object.fromEntries(customers.map((c) => [c.tenantId, c.orgName]));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Activity" subtitle="Product events across all customers, newest first. No passwords, tokens or review text are recorded." />
      <form className="mb-4 flex gap-2">
        <select name="type" defaultValue={type ?? "all"} className={inputClass} aria-label="Event type">
          <option value="all">All events</option>
          {EVENT_FILTERS.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
        <button className={buttonClass}>Filter</button>
      </form>
      <Table>
        <thead>
          <tr>
            <th className={th}>When</th>
            <th className={th}>Event</th>
            <th className={th}>User</th>
            <th className={th}>Account</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id}>
              <td className={`${td} whitespace-nowrap`}>{fmtDateTime(e.created_at)}</td>
              <td className={td}>
                {describeEvent(e)}
                {e.impersonation_session_id && <span className="ml-1.5"><Badge tone="violet">admin view</Badge></span>}
              </td>
              <td className={td}>{(e.user_id && emails[e.user_id]) || "—"}</td>
              <td className={td}>
                {e.tenant_id ? <Link href={`/super-admin/customers/${e.tenant_id}?tab=activity`} className="hover:underline">{orgs[e.tenant_id] ?? "—"}</Link> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length === 0 && <Empty>No events yet. Tracking started with the admin console release.</Empty>}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/super-admin/activity" params={{ type }} />
    </div>
  );
}
