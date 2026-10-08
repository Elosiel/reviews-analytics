import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { emailsFor, getCustomerDetail, isBanned, listEvents, listFeedback } from "@/lib/admin/data";
import { describeEvent } from "@/lib/admin/events";
import { trialDaysLeft } from "@/lib/billing/trial";
import { InternalToggle, NoteForm, TrialEditor, UserActions } from "@/components/admin/actions";
import {
  Badge,
  Card,
  Empty,
  FEEDBACK_TYPE_LABELS,
  FeedbackStatusBadge,
  HealthBadge,
  PriorityBadge,
  Pagination,
  StatCard,
  Table,
  TrialBadge,
  fmtDate,
  fmtDateTime,
  pageParam,
  strParam,
  td,
  th,
  timeAgo,
  formatDetails,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "Overview"],
  ["users", "Users"],
  ["locations", "Locations"],
  ["trial", "Trial"],
  ["activity", "Activity"],
  ["logins", "Sign-ins"],
  ["feedback", "Feedback"],
  ["notes", "Notes"],
  ["audit", "Audit"],
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminPage();
  const { tenantId } = await params;
  if (!UUID.test(tenantId)) notFound();
  const sp = await searchParams;
  const tab = (strParam(sp.tab) ?? "overview") as (typeof TABS)[number][0];
  const page = pageParam(sp.page);

  const detail = await getCustomerDetail(admin, tenantId);
  if (!detail) notFound();
  const { summary: c } = detail;

  const [events, feedback] = await Promise.all([
    tab === "activity" || tab === "overview" ? listEvents(admin, { tenantId, page: tab === "activity" ? page : 1, pageSize: tab === "activity" ? 50 : 8 }) : null,
    tab === "feedback" || tab === "overview" ? listFeedback(admin, { tenantId, pageSize: 50 }) : null,
  ]);
  const emails = events ? await emailsFor(admin, events.rows.map((e) => e.user_id)) : {};

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/super-admin/customers" className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Customers
      </Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-950">{c.orgName}</h1>
            <HealthBadge status={c.health} />
            <TrialBadge state={c.trial} daysLeft={c.trialDaysLeft} />
            {c.isInternal && <Badge tone="dark">internal</Badge>}
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {c.ownerName ? `${c.ownerName} · ` : ""}
            {c.ownerEmail} · signed up {fmtDate(c.createdAt)}
          </p>
          {c.healthReasons.length > 0 && <p className="mt-1 text-xs text-zinc-500">{c.healthReasons.join(" · ")}</p>}
        </div>
        <InternalToggle tenantId={tenantId} isInternal={c.isInternal} />
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-200" aria-label="Customer sections">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/super-admin/customers/${tenantId}?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium",
              tab === key ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-900"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Locations" value={c.locationCount} hint={`${c.gbpLocationCount} via Google · ${c.brokenLocationCount} broken`} />
            <StatCard label="Users" value={c.memberCount} />
            <StatCard label="Reviews analyzed" value={c.analyzedCount.toLocaleString()} hint={`${c.reviewCount.toLocaleString()} imported`} />
            <StatCard label="Last active" value={timeAgo(c.lastActivityAt)} hint={`sign-in ${timeAgo(c.lastSignInAt)}`} />
            <StatCard label="Events (7d)" value={c.events7d} />
            <StatCard label="Open feedback" value={c.openFeedback} tone={c.openBugs ? "bad" : "default"} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Google connection">
              {detail.google ? (
                <div className="space-y-1 text-sm">
                  <p className="text-zinc-800">Connected {fmtDateTime(detail.google.connectedAt)}</p>
                  <p className="text-xs text-zinc-500">Last review sync {timeAgo(c.lastSyncedAt)}</p>
                  {c.brokenLocationCount > 0 && <p className="text-xs text-red-600">{c.brokenLocationCount} location(s) need Google reconnected.</p>}
                  <p className="text-[11px] text-zinc-400">Tokens are encrypted and never shown here.</p>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Google Business Profile not connected.</p>
              )}
            </Card>
            <Card title="Recent activity" actions={<Link href={`?tab=activity`} className="text-xs text-zinc-500 hover:text-zinc-900">All activity</Link>}>
              <Timeline rows={events?.rows ?? []} emails={emails} />
            </Card>
          </div>
        </div>
      )}

      {tab === "users" && (
        <Table>
          <thead>
            <tr>
              <th className={th}>User</th>
              <th className={th}>Role</th>
              <th className={th}>Status</th>
              <th className={th}>Sign-in method</th>
              <th className={th}>Created</th>
              <th className={th}>Last sign-in</th>
              <th className={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {detail.users.map((u) => (
              <tr key={u.user_id}>
                <td className={td}>
                  <p className="font-medium text-zinc-900">{u.full_name || u.email}</p>
                  <p className="text-xs text-zinc-500">{u.email}</p>
                </td>
                <td className={td}>
                  {u.team_role ?? "—"} {u.admin_role && <Badge tone="dark">{u.admin_role.replace("_", " ")}</Badge>}
                  <p className="text-[11px] text-zinc-400">All {c.locationCount} location{c.locationCount === 1 ? "" : "s"}</p>
                </td>
                <td className={td}>
                  {isBanned(u) ? <Badge tone="red">Disabled</Badge> : u.email_confirmed_at ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Email unconfirmed</Badge>}
                </td>
                <td className={td}>{u.provider}</td>
                <td className={td}>{fmtDate(u.created_at)}</td>
                <td className={td}>{timeAgo(u.last_sign_in_at)}</td>
                <td className={td}>
                  <UserActions userId={u.user_id} email={u.email} banned={isBanned(u)} isAdmin={!!u.admin_role} confirmed={!!u.email_confirmed_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {tab === "locations" && (
        <Table>
          <thead>
            <tr>
              <th className={th}>Location</th>
              <th className={th}>Source</th>
              <th className={th}>Google</th>
              <th className={th}>Last sync</th>
              <th className={th}>Reviews</th>
              <th className={th}>Trial</th>
            </tr>
          </thead>
          <tbody>
            {detail.locations.map((l) => {
              const lt = detail.trial?.locations[l.id];
              const counts = detail.locationReviewCounts[l.id];
              return (
                <tr key={l.id}>
                  <td className={td}>
                    <p className="font-medium text-zinc-900">{l.name}</p>
                    <p className="text-xs text-zinc-500">{l.address ?? "—"}</p>
                  </td>
                  <td className={td}>{l.google_location_id.startsWith("locations/") ? "Google Business Profile" : "Places import (demo)"}</td>
                  <td className={td}>{l.connection_broken ? <Badge tone="red">Broken {timeAgo(l.connection_broken_at)}</Badge> : <Badge tone="green">OK</Badge>}</td>
                  <td className={td}>{timeAgo(l.last_synced_at)}</td>
                  <td className={`${td} tabular-nums`}>
                    {(counts?.analyzed ?? 0).toLocaleString()}
                    <span className="text-xs text-zinc-400"> / {(counts?.reviews ?? 0).toLocaleString()}</span>
                  </td>
                  <td className={td}>
                    {lt ? (
                      <>
                        <TrialBadge state={c.paid ? "paid" : lt.active ? (trialDaysLeft(lt.trialEndsAt) <= 7 ? "expiring" : "active") : "expired"} daysLeft={trialDaysLeft(lt.trialEndsAt)} />
                        <p className="text-[11px] text-zinc-400">
                          until {fmtDate(lt.trialEndsAt)} · {lt.source === "extension" ? "custom extension" : "account trial"}
                        </p>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {tab === "trial" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Account trial" actions={<TrialEditor tenantId={tenantId} currentEndsAt={c.trialEndsAt} />}>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-zinc-500">Started</dt>
              <dd>{fmtDateTime(c.trialStartedAt)}</dd>
              <dt className="text-zinc-500">Ends</dt>
              <dd>{fmtDateTime(c.trialEndsAt)}</dd>
              <dt className="text-zinc-500">Days left</dt>
              <dd>{c.trialEndsAt ? trialDaysLeft(c.trialEndsAt) : "—"}</dd>
              <dt className="text-zinc-500">Billing</dt>
              <dd>{c.paid ? "Paid plan" : "Not connected (no billing yet)"}</dd>
            </dl>
          </Card>
          <Card title="Per-location trial">
            <ul className="divide-y divide-zinc-100 text-sm">
              {detail.locations.map((l) => {
                const lt = detail.trial?.locations[l.id];
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="truncate">{l.name}</span>
                    <span className="shrink-0 text-xs text-zinc-600">
                      {lt ? `${fmtDate(lt.trialEndsAt)} · ${trialDaysLeft(lt.trialEndsAt)}d · ${lt.source === "extension" ? "custom" : "standard 30d"}` : "—"}
                    </span>
                  </li>
                );
              })}
              {detail.locations.length === 0 && <li className="py-2 text-zinc-500">No locations yet.</li>}
            </ul>
            <p className="mt-3 text-[11px] text-zinc-400">Custom per-location extensions are set by migration and never edited here.</p>
          </Card>
        </div>
      )}

      {tab === "activity" && events && (
        <Card title="Activity timeline">
          <Timeline rows={events.rows} emails={emails} />
          <Pagination page={page} total={events.total} pageSize={50} basePath={`/super-admin/customers/${tenantId}`} params={{ tab: "activity" }} />
        </Card>
      )}

      {tab === "logins" && (
        <div className="space-y-6">
          <Table>
            <thead>
              <tr>
                <th className={th}>User</th>
                <th className={th}>Session started</th>
                <th className={th}>Last refresh</th>
                <th className={th}>2FA</th>
                <th className={th}>IP</th>
                <th className={th}>Device</th>
              </tr>
            </thead>
            <tbody>
              {detail.sessions.map((s, i) => (
                <tr key={`${s.user_id}-${i}`}>
                  <td className={td}>{s.email}</td>
                  <td className={td}>{fmtDateTime(s.created_at)}</td>
                  <td className={td}>{s.refreshed_at ? fmtDateTime(`${s.refreshed_at}Z`) : "—"}</td>
                  <td className={td}>{s.aal === "aal2" ? "yes" : "no"}</td>
                  <td className={td}>{s.ip ?? "—"}</td>
                  <td className={`${td} max-w-[280px] truncate`} title={s.user_agent ?? ""}>{s.user_agent ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {detail.sessions.length === 0 && <Empty>No active sessions.</Empty>}
          <p className="text-[11px] text-zinc-400">
            Active sessions from Supabase Auth (signed-out sessions disappear). Sign-in events recorded by the app are in Activity.
          </p>
          <Card title="Admin “view as” sessions">
            <ImpersonationList rows={detail.impersonations} />
          </Card>
        </div>
      )}

      {tab === "feedback" && feedback && (
        <Table>
          <thead>
            <tr>
              <th className={th}>Subject</th>
              <th className={th}>Type</th>
              <th className={th}>Status</th>
              <th className={th}>Priority</th>
              <th className={th}>From</th>
              <th className={th}>Sent</th>
            </tr>
          </thead>
          <tbody>
            {feedback.rows.map((f) => (
              <tr key={f.id}>
                <td className={td}><Link href={`/super-admin/feedback/${f.id}`} className="font-medium text-zinc-900 hover:underline">{f.subject}</Link></td>
                <td className={td}>{FEEDBACK_TYPE_LABELS[f.type] ?? f.type}</td>
                <td className={td}><FeedbackStatusBadge status={f.status} /></td>
                <td className={td}><PriorityBadge priority={f.priority} /></td>
                <td className={td}>{f.user_email ?? "—"}</td>
                <td className={td}>{timeAgo(f.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {tab === "feedback" && feedback?.rows.length === 0 && <Empty>No feedback from this customer.</Empty>}

      {tab === "notes" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card title="Internal notes">
            {detail.notes.length === 0 ? (
              <p className="text-sm text-zinc-500">No notes yet.</p>
            ) : (
              <ul className="space-y-4">
                {detail.notes.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className="whitespace-pre-wrap text-zinc-800">{n.note}</p>
                    <p className="mt-1 text-xs text-zinc-400">{n.author_email} · {fmtDateTime(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Add a note">
            <NoteForm url={`/api/super-admin/customers/${tenantId}/notes`} />
            <p className="mt-2 text-[11px] text-zinc-400">Only admins can see notes. Customers never do.</p>
          </Card>
        </div>
      )}

      {tab === "audit" && (
        <Table>
          <thead>
            <tr>
              <th className={th}>When</th>
              <th className={th}>Admin</th>
              <th className={th}>Action</th>
              <th className={th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {detail.audit.map((a) => (
              <tr key={a.id}>
                <td className={td}>{fmtDateTime(a.created_at)}</td>
                <td className={td}>{a.actor_email ?? "system"}</td>
                <td className={td}><code className="text-xs">{a.action}</code></td>
                <td className={`${td} text-xs text-zinc-500`}>{formatDetails(a.details)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {tab === "audit" && detail.audit.length === 0 && <Empty>No admin actions on this account yet.</Empty>}
    </div>
  );
}

function Timeline({ rows, emails }: { rows: { id: number; created_at: string; user_id: string | null; event_type: string; metadata: Record<string, unknown>; impersonation_session_id: string | null }[]; emails: Record<string, string> }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">No activity recorded yet. Tracking started with the admin console release.</p>;
  const days = rows.map((e) => fmtDate(e.created_at));
  return (
    <ol className="space-y-1">
      {rows.map((e, i) => {
        const header = i === 0 || days[i] !== days[i - 1] ? days[i] : null;
        return (
          <li key={e.id}>
            {header && <p className="mt-3 mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{header}</p>}
            <div className="flex items-start justify-between gap-3 py-1 text-sm">
              <p className="min-w-0 text-zinc-800">
                <span className="text-zinc-500">{(e.user_id && emails[e.user_id]) || "Someone"}</span> — {describeEvent(e)}
                {e.impersonation_session_id && <span className="ml-1.5"><Badge tone="violet">admin view</Badge></span>}
              </p>
              <span className="shrink-0 text-xs text-zinc-400">{new Date(e.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ImpersonationList({ rows }: { rows: { id: string; admin_email: string | null; target_email: string | null; reason: string; started_at: string; expires_at: string; ended_at: string | null; end_reason: string | null }[] }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">None.</p>;
  return (
    <ul className="divide-y divide-zinc-100 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="py-2">
          <p className="text-zinc-800">
            {r.admin_email} viewed as {r.target_email} · {fmtDateTime(r.started_at)}
            {r.ended_at ? ` → ${r.end_reason ?? "ended"} ${fmtDateTime(r.ended_at)}` : " · in progress"}
          </p>
          <p className="text-xs text-zinc-500">Reason: {r.reason}</p>
        </li>
      ))}
    </ul>
  );
}
