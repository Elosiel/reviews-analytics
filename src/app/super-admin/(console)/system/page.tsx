import { requireAdminPage } from "@/lib/admin/auth";
import { getSystemHealth } from "@/lib/admin/data";
import { Badge, Card, Empty, PageHeader, StatCard, Table, fmtDateTime, td, th, timeAgo } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  const admin = await requireAdminPage();
  const s = await getSystemHealth(admin);
  const h = s.health;
  const http = h.http_calls_24h ?? { total: 0, failed: 0, timed_out: 0 };
  const errorsTotal = Object.values(s.errorsByCategory24h).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="System health"
        subtitle={`What the app can see about itself. Deployment: ${s.deployment.env}${s.deployment.commit ? ` · ${s.deployment.commit}` : ""}.`}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Database" value={s.dbOk ? "OK" : "Error"} tone={s.dbOk ? "good" : "bad"} hint={`${s.dbLatencyMs} ms round trip`} />
        <StatCard label="Errors (24h)" value={errorsTotal} tone={errorsTotal ? "warn" : "default"} />
        <StatCard label="Job HTTP calls (24h)" value={http.total} hint={`${http.failed} failed · ${http.timed_out} timed out`} tone={http.failed ? "warn" : "default"} />
        <StatCard label="Pending analysis" value={h.pending_analysis ?? "—"} hint="reviews in the 90-day window" />
        <StatCard label="Broken connections" value={h.broken_locations ?? 0} tone={h.broken_locations ? "bad" : "default"} />
        <StatCard label="Stale syncs (>12h)" value={h.stale_locations ?? 0} tone={h.stale_locations ? "warn" : "default"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Scheduled jobs (pg_cron)">
          <ul className="divide-y divide-zinc-100 text-sm">
            {(h.cron_jobs ?? []).map((j) => (
              <li key={j.job} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{j.job}</p>
                  <p className="text-xs text-zinc-500">{j.schedule} · last run {timeAgo(j.last_run)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {j.failures_24h > 0 && <Badge tone="red">{`${j.failures_24h} failed (24h)`}</Badge>}
                  <Badge tone={!j.active ? "gray" : j.last_status === "succeeded" ? "green" : j.last_status ? "amber" : "gray"}>
                    {!j.active ? "paused" : j.last_status ?? "not run"}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-zinc-400">A succeeded job means the database fired it; whether the app handled the call shows under errors and HTTP calls.</p>
        </Card>
        <Card title="Configuration (presence only — values are never shown)">
          <ul className="space-y-1.5 text-sm">
            {[
              ["Anthropic (review analysis)", s.config.anthropic],
              ["Resend (emails: invites, digest)", s.config.resend],
              ["Google OAuth", s.config.google],
              ["Cron secret", s.config.cronSecret],
              ["Token encryption key", s.config.tokenEncryption],
            ].map(([label, ok]) => (
              <li key={label as string} className="flex items-center justify-between">
                <span className="text-zinc-700">{label}</span>
                <Badge tone={ok ? "green" : "red"}>{ok ? "configured" : "missing"}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-zinc-600">Open impersonation sessions: <strong>{h.open_impersonations ?? 0}</strong></p>
        </Card>
      </div>

      <Card title="Errors by category (24h)">
        {errorsTotal === 0 ? (
          <p className="text-sm text-zinc-500">No errors logged in the last 24 hours.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(s.errorsByCategory24h).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <Badge key={k} tone="amber">{`${k}: ${v}`}</Badge>
            ))}
          </div>
        )}
      </Card>

      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-zinc-900">Recent errors</h2>
        <Table>
          <thead>
            <tr>
              <th className={th}>When</th>
              <th className={th}>Category</th>
              <th className={th}>Where</th>
              <th className={th}>Message (sanitized)</th>
              <th className={th}>Account</th>
            </tr>
          </thead>
          <tbody>
            {s.recentErrors.map((e) => (
              <tr key={e.id}>
                <td className={`${td} whitespace-nowrap`}>{fmtDateTime(e.created_at)}</td>
                <td className={td}><Badge>{e.category}</Badge></td>
                <td className={`${td} font-mono text-xs`}>{e.source}</td>
                <td className={`${td} max-w-md text-xs`}>{e.message}</td>
                <td className={td}>
                  {e.tenant_id ? <a href={`/super-admin/customers/${e.tenant_id}`} className="text-xs hover:underline">open</a> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {s.recentErrors.length === 0 && <Empty>No errors logged yet.</Empty>}
      </div>
      <p className="text-[11px] text-zinc-400">
        Not covered here (needs an external monitoring service such as Sentry or Vercel Observability): uncaught exceptions
        in parts of the app that don&apos;t log here, front-end crashes, uptime checks and alerting.
      </p>
    </div>
  );
}
