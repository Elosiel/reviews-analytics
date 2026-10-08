import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getCustomerSummaries, isBanned, listUsers, PAGE_SIZE } from "@/lib/admin/data";
import { UserActions } from "@/components/admin/actions";
import {
  Badge,
  Empty,
  PageHeader,
  Pagination,
  Table,
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

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const [{ rows, total }, customers] = await Promise.all([listUsers(admin, { q, page }), getCustomerSummaries(admin)]);
  const orgs = Object.fromEntries(customers.map((c) => [c.tenantId, c]));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Users"
        subtitle="Every login. Passwords are never stored or shown — Supabase Auth keeps only a one-way hash."
        actions={
          <a href={`/api/super-admin/export?kind=users${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={secondaryButtonClass}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <form className="mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Search name or email…" className={`${inputClass} w-72`} aria-label="Search users" />
        <button className={buttonClass}>Search</button>
      </form>
      <Table>
        <thead>
          <tr>
            <th className={th}>User</th>
            <th className={th}>Organization</th>
            <th className={th}>Role</th>
            <th className={th}>Status</th>
            <th className={th}>Sign-in</th>
            <th className={th}>Created</th>
            <th className={th}>Last sign-in</th>
            <th className={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const org = u.tenant_id ? orgs[u.tenant_id] : null;
            return (
              <tr key={u.user_id}>
                <td className={td}>
                  <p className="font-medium text-zinc-900">{u.full_name || "—"}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </td>
                <td className={td}>
                  {org ? (
                    <Link href={`/super-admin/customers/${org.tenantId}`} className="hover:underline">{org.orgName}</Link>
                  ) : (
                    "—"
                  )}
                  {org && <p className="text-[11px] text-zinc-400">{`${org.locationCount} location${org.locationCount === 1 ? "" : "s"} (all)`}</p>}
                </td>
                <td className={td}>
                  {u.team_role ?? "—"}
                  {u.admin_role && <div><Badge tone="dark">{u.admin_role.replace("_", " ")}</Badge></div>}
                </td>
                <td className={td}>
                  {isBanned(u) ? <Badge tone="red">Disabled</Badge> : u.email_confirmed_at ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Unconfirmed</Badge>}
                </td>
                <td className={td}>{u.provider}</td>
                <td className={td}>{fmtDate(u.created_at)}</td>
                <td className={td}>{timeAgo(u.last_sign_in_at)}</td>
                <td className={td}>
                  <UserActions userId={u.user_id} email={u.email} banned={isBanned(u)} isAdmin={!!u.admin_role} confirmed={!!u.email_confirmed_at} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {rows.length === 0 && <Empty>No users found.</Empty>}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/super-admin/users" params={{ q }} />
    </div>
  );
}
