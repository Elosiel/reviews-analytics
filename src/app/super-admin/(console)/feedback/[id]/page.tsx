import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { emailsFor, getCustomerSummaries, getFeedback, listEvents } from "@/lib/admin/data";
import { describeEvent } from "@/lib/admin/events";
import { FeedbackControls, NoteForm } from "@/components/admin/actions";
import { Badge, Card, FEEDBACK_TYPE_LABELS, FeedbackStatusBadge, PriorityBadge, fmtDateTime, timeAgo } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function FeedbackDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { item: f, notes } = await getFeedback(admin, id);
  if (!f) notFound();
  const [customers, events] = await Promise.all([getCustomerSummaries(admin), listEvents(admin, { tenantId: f.tenant_id, pageSize: 12 })]);
  const org = customers.find((c) => c.tenantId === f.tenant_id);
  const emails = await emailsFor(admin, events.rows.map((e) => e.user_id));
  const ctx = (f.context ?? {}) as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/super-admin/feedback" className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Feedback
      </Link>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-950">{f.subject}</h1>
        <Badge>{FEEDBACK_TYPE_LABELS[f.type] ?? f.type}</Badge>
        <FeedbackStatusBadge status={f.status} />
        <PriorityBadge priority={f.priority} />
        {f.impersonation_session_id && <Badge tone="violet">sent during admin view</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card title="Message">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800">{f.message}</p>
            {f.rating && <p className="mt-4 text-sm text-zinc-600">Experience rating: <strong>{f.rating}/5</strong></p>}
          </Card>
          <Card title="Workflow">
            <FeedbackControls id={f.id} status={f.status} priority={f.priority} />
          </Card>
          <Card title="Internal notes">
            {notes.length > 0 && (
              <ul className="mb-4 space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className="whitespace-pre-wrap text-zinc-800">{n.note}</p>
                    <p className="text-xs text-zinc-400">{n.author_email} · {fmtDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
            <NoteForm url={`/api/super-admin/feedback/${f.id}/notes`} />
            <p className="mt-2 text-[11px] text-zinc-400">Notes are internal. The customer never sees them.</p>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="From">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-zinc-500">Customer</dt><dd>{org ? <Link href={`/super-admin/customers/${f.tenant_id}`} className="font-medium hover:underline">{org.orgName}</Link> : "—"}</dd></div>
              <div><dt className="text-xs text-zinc-500">User</dt><dd>{f.user_email ?? "—"}</dd></div>
              <div><dt className="text-xs text-zinc-500">Sent</dt><dd>{fmtDateTime(f.created_at)}</dd></div>
              {f.resolved_at && <div><dt className="text-xs text-zinc-500">Resolved</dt><dd>{fmtDateTime(f.resolved_at)}</dd></div>}
            </dl>
          </Card>
          <Card title="Technical context">
            <dl className="space-y-2 text-xs">
              <div><dt className="text-zinc-500">Page</dt><dd className="font-mono text-zinc-800">{f.route ?? "—"}</dd></div>
              {Object.entries(ctx).map(([k, v]) => (
                <div key={k}><dt className="text-zinc-500">{k.replace(/_/g, " ")}</dt><dd className="break-words font-mono text-zinc-800">{String(v)}</dd></div>
              ))}
            </dl>
          </Card>
          <Card title="Related activity">
            {events.rows.length === 0 ? (
              <p className="text-sm text-zinc-500">No recorded activity.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {events.rows.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="text-zinc-700">{(e.user_id && emails[e.user_id]?.split("@")[0]) || "—"}: {describeEvent(e)}</span>
                    <span className="shrink-0 text-zinc-400">{timeAgo(e.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
