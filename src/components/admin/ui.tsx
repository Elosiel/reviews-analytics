import Link from "next/link";
import { cn } from "@/lib/utils";
import { HEALTH_LABELS, type HealthStatus, type TrialState } from "@/lib/admin/health";

// Admin console building blocks (server-renderable).

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return (
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d}d ago`;
  return fmtDate(iso);
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-zinc-950">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-zinc-200 bg-white", className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
          <h2 className="text-[13px] font-semibold text-zinc-900">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "warn" | "bad" | "good" | "muted";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-xl border bg-white px-4 py-3.5",
        tone === "warn" ? "border-amber-200" : tone === "bad" ? "border-red-200" : "border-zinc-200",
        href && "hover:border-zinc-400 motion-safe:transition-colors"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "warn" ? "text-amber-700" : tone === "bad" ? "text-red-700" : tone === "good" ? "text-emerald-700" : tone === "muted" ? "text-zinc-400" : "text-zinc-950"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const BADGE_TONES = {
  gray: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  teal: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  dark: "bg-zinc-900 text-white ring-zinc-900",
} as const;

export function Badge({ tone = "gray", children }: { tone?: keyof typeof BADGE_TONES; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

const HEALTH_TONE: Record<HealthStatus, keyof typeof BADGE_TONES> = {
  healthy: "green",
  low_activity: "amber",
  inactive: "gray",
  onboarding: "teal",
  trial_expiring: "amber",
  needs_attention: "red",
  connection_issue: "red",
};

export function HealthBadge({ status, title }: { status: HealthStatus; title?: string }) {
  return (
    <span title={title}>
      <Badge tone={HEALTH_TONE[status]}>{HEALTH_LABELS[status]}</Badge>
    </span>
  );
}

export function TrialBadge({ state, daysLeft }: { state: TrialState; daysLeft: number | null }) {
  if (state === "paid") return <Badge tone="green">Paid</Badge>;
  if (state === "none") return <Badge>No trial</Badge>;
  if (state === "expired") return <Badge tone="red">Trial ended</Badge>;
  return <Badge tone={state === "expiring" ? "amber" : "teal"}>{`Trial · ${daysLeft}d left`}</Badge>;
}

export const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  improvement: "Improvement",
  feature: "Feature request",
  general: "General",
  support: "Needs help",
};
export const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  new: "New",
  in_review: "In review",
  planned: "Planned",
  resolved: "Resolved",
  closed: "Closed",
};

export function FeedbackStatusBadge({ status }: { status: string }) {
  const tone = status === "new" ? "teal" : status === "in_review" ? "amber" : status === "planned" ? "violet" : status === "resolved" ? "green" : "gray";
  return <Badge tone={tone}>{FEEDBACK_STATUS_LABELS[status] ?? status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-xs text-zinc-400">—</span>;
  const tone = priority === "urgent" ? "red" : priority === "high" ? "amber" : priority === "medium" ? "teal" : "gray";
  return <Badge tone={tone}>{priority[0].toUpperCase() + priority.slice(1)}</Badge>;
}

/** Horizontal scroll stays inside the table container — never the page. */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full min-w-[720px] text-left text-[13px]">{children}</table>
    </div>
  );
}
export const th = "border-b border-zinc-200 bg-zinc-50/80 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500";
export const td = "border-b border-zinc-100 px-4 py-3 align-top text-zinc-700";

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-zinc-500">{children}</p>;
}

export function Pagination({
  page,
  total,
  pageSize,
  basePath,
  params,
}: {
  page: number;
  total: number;
  pageSize: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams(Object.entries({ ...params, page: String(p) }).filter(([, v]) => v) as [string, string][]);
    return `${basePath}?${q}`;
  };
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
      <span>
        {total === 0 ? "No results" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 hover:border-zinc-400">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 hover:border-zinc-400">
            Next
          </Link>
        )}
      </div>
    </div>
  );
}

export const inputClass =
  "h-9 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 outline-none focus-visible:border-zinc-900 focus-visible:ring-4 focus-visible:ring-zinc-900/10";
export const buttonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-zinc-950 px-3.5 text-[13px] font-medium text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-900/20 disabled:opacity-50";
export const secondaryButtonClass =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-800 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-900/10 disabled:opacity-50";

export function pageParam(v: string | string[] | undefined): number {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
export function strParam(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.slice(0, 200) || undefined;
}

export function formatDetails(d: unknown): string {
  if (!d || typeof d !== "object") return "";
  return Object.entries(d as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ")
    .slice(0, 300);
}
