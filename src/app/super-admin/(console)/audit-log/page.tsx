import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/auth";
import { listAudit, PAGE_SIZE } from "@/lib/admin/data";
import { Empty, PageHeader, Pagination, Table, buttonClass, fmtDateTime, formatDetails, inputClass, pageParam, strParam, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const ACTIONS = ["impersonation", "user", "feedback", "account", "trial", "note", "export", "admin_role"];

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const action = strParam(sp.action);
  const page = pageParam(sp.page);
  const { rows, total } = await listAudit(admin, { action, page });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Audit log" subtitle="Every privileged admin action. Append-only: entries can't be edited or deleted, even by the server." />
      <form className="mb-4 flex gap-2">
        <select name="action" defaultValue={action ?? "all"} className={inputClass} aria-label="Action">
          <option value="all">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>{a.replace("_", " ")}</option>
          ))}
        </select>
        <button className={buttonClass}>Filter</button>
      </form>
      <Table>
        <thead>
          <tr>
            <th className={th}>When</th>
            <th className={th}>Admin</th>
            <th className={th}>Action</th>
            <th className={th}>Target</th>
            <th className={th}>Details</th>
            <th className={th}>IP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td className={`${td} whitespace-nowrap`}>{fmtDateTime(a.created_at)}</td>
              <td className={td}>{a.actor_email ?? "system"}</td>
              <td className={td}><code className="text-xs">{a.action}</code></td>
              <td className={td}>
                {a.tenant_id ? <Link href={`/super-admin/customers/${a.tenant_id}?tab=audit`} className="hover:underline">{a.target_type ?? "account"}</Link> : a.target_type ?? "—"}
                {a.target_id && <p className="font-mono text-[11px] text-zinc-400">{String(a.target_id).slice(0, 8)}…</p>}
              </td>
              <td className={`${td} max-w-sm text-xs text-zinc-500`}>{formatDetails(a.details)}</td>
              <td className={`${td} text-xs`}>{a.ip ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length === 0 && <Empty>No admin actions recorded yet.</Empty>}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/super-admin/audit-log" params={{ action }} />
    </div>
  );
}
