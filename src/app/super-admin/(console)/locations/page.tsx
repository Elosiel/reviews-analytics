import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { getCustomerSummaries, PAGE_SIZE } from "@/lib/admin/data";
import { createServiceClient } from "@/lib/supabase/service";
import { Badge, Empty, PageHeader, Pagination, Table, buttonClass, inputClass, pageParam, strParam, td, th, timeAgo, fmtDate } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function LocationsAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const q = strParam(sp.q)?.replace(/[%,()]/g, " ");
  const status = strParam(sp.status);
  const page = pageParam(sp.page);
  const from = (page - 1) * PAGE_SIZE;

  let query = createServiceClient()
    .from("locations")
    .select("id, tenant_id, google_location_id, name, address, rating, review_count, connection_broken, last_synced_at, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (q) query = query.or(`name.ilike.%${q}%,address.ilike.%${q}%`);
  if (status === "broken") query = query.eq("connection_broken", true);
  if (status === "gbp") query = query.like("google_location_id", "locations/%");
  const [{ data: rows, count }, customers] = await Promise.all([query, getCustomerSummaries(admin)]);
  const orgs = Object.fromEntries(customers.map((c) => [c.tenantId, c]));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Locations" subtitle="Every restaurant location across all accounts." />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search name or address…" className={`${inputClass} w-72`} aria-label="Search locations" />
        <select name="status" defaultValue={status ?? ""} className={inputClass} aria-label="Status">
          <option value="">All</option>
          <option value="gbp">Google Business Profile</option>
          <option value="broken">Connection broken</option>
        </select>
        <button className={buttonClass}>Apply</button>
      </form>
      <Table>
        <thead>
          <tr>
            <th className={th}>Location</th>
            <th className={th}>Account</th>
            <th className={th}>Source</th>
            <th className={th}>Google</th>
            <th className={th}>Rating</th>
            <th className={th}>Last sync</th>
            <th className={th}>Added</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((l) => {
            const org = orgs[l.tenant_id];
            return (
              <tr key={l.id}>
                <td className={td}>
                  <p className="font-medium text-zinc-900">{l.name}</p>
                  <p className="text-xs text-zinc-500">{l.address ?? "—"}</p>
                </td>
                <td className={td}>
                  {org ? <Link href={`/super-admin/customers/${l.tenant_id}?tab=locations`} className="hover:underline">{org.orgName}</Link> : "—"}
                  {org?.isInternal && <div><Badge tone="dark">internal</Badge></div>}
                </td>
                <td className={td}>{l.google_location_id.startsWith("locations/") ? "Google Business Profile" : "Places import"}</td>
                <td className={td}>{l.connection_broken ? <Badge tone="red">Broken</Badge> : <Badge tone="green">OK</Badge>}</td>
                <td className={`${td} tabular-nums`}>{l.rating ? `${Number(l.rating).toFixed(1)}★ · ${l.review_count}` : "—"}</td>
                <td className={td}>{timeAgo(l.last_synced_at)}</td>
                <td className={td}>{fmtDate(l.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {(rows ?? []).length === 0 && <Empty>No locations found.</Empty>}
      <Pagination page={page} total={count ?? 0} pageSize={PAGE_SIZE} basePath="/super-admin/locations" params={{ q, status }} />
    </div>
  );
}
