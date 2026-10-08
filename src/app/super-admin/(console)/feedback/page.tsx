import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getCustomerSummaries, listFeedback, PAGE_SIZE } from "@/lib/admin/data";
import {
  Empty,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  FeedbackStatusBadge,
  PageHeader,
  Pagination,
  PriorityBadge,
  Table,
  buttonClass,
  inputClass,
  pageParam,
  secondaryButtonClass,
  strParam,
  td,
  th,
  timeAgo,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_TABS = [["open", "Open"], ["all", "All"], ...Object.entries(FEEDBACK_STATUS_LABELS)] as [string, string][];

export default async function FeedbackInbox({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const status = strParam(sp.status) ?? "open";
  const type = strParam(sp.type) ?? "all";
  const q = strParam(sp.q);
  const sort = strParam(sp.sort) ?? "newest";
  const page = pageParam(sp.page);
  const [{ rows, total }, customers] = await Promise.all([listFeedback(admin, { status, type, q, sort, page }), getCustomerSummaries(admin)]);
  const orgs = Object.fromEntries(customers.map((c) => [c.tenantId, c.orgName]));
  const params = { status, type, q, sort };
  const qs = (over: Record<string, string>) =>
    `/super-admin/feedback?${new URLSearchParams(Object.entries({ ...params, ...over }).filter(([, v]) => v) as [string, string][])}`;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Feedback"
        subtitle="Bug reports, ideas and help requests from inside the customer app."
        actions={
          <a href={`/api/super-admin/export?kind=feedback&status=${status}&type=${type}`} className={secondaryButtonClass}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-zinc-200">
        {STATUS_TABS.map(([k, label]) => (
          <Link
            key={k}
            href={qs({ status: k, page: "1" })}
            className={cn("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium", status === k ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-900")}
          >
            {label}
          </Link>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input type="hidden" name="status" value={status} />
        <select name="type" defaultValue={type} className={inputClass} aria-label="Type">
          <option value="all">All types</option>
          {Object.entries(FEEDBACK_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input name="q" defaultValue={q} placeholder="Search subject, message, email…" className={`${inputClass} w-72`} aria-label="Search feedback" />
        <select name="sort" defaultValue={sort} className={inputClass} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
        <button className={buttonClass}>Apply</button>
      </form>
      <Table>
        <thead>
          <tr>
            <th className={th}>Subject</th>
            <th className={th}>Type</th>
            <th className={th}>Status</th>
            <th className={th}>Priority</th>
            <th className={th}>Customer</th>
            <th className={th}>From</th>
            <th className={th}>Rating</th>
            <th className={th}>Sent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id} className="hover:bg-zinc-50/70">
              <td className={td}>
                <Link href={`/super-admin/feedback/${f.id}`} className="font-medium text-zinc-950 hover:underline">{f.subject}</Link>
                <p className="line-clamp-1 max-w-md text-xs text-zinc-500">{f.message}</p>
              </td>
              <td className={td}>{FEEDBACK_TYPE_LABELS[f.type] ?? f.type}</td>
              <td className={td}><FeedbackStatusBadge status={f.status} /></td>
              <td className={td}><PriorityBadge priority={f.priority} /></td>
              <td className={td}>
                <Link href={`/super-admin/customers/${f.tenant_id}?tab=feedback`} className="hover:underline">{orgs[f.tenant_id] ?? "—"}</Link>
              </td>
              <td className={td}>{f.user_email ?? "—"}</td>
              <td className={td}>{f.rating ? `${f.rating}/5` : "—"}</td>
              <td className={`${td} whitespace-nowrap`}>{timeAgo(f.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {rows.length === 0 && <Empty>Nothing here.</Empty>}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/super-admin/feedback" params={params} />
    </div>
  );
}
