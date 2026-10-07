import { createServiceClient } from "@/lib/supabase/service";
import type { AdminContext } from "@/lib/admin/auth";
import { customerHealth, trialState, type HealthStatus, type TrialState } from "@/lib/admin/health";
import { restaurantDisplayName } from "@/lib/team/invite-shared";
import { getTrialStatus } from "@/lib/billing/trial-status";
import { trialDaysLeft } from "@/lib/billing/trial";

// Privileged read models for the admin console. Every function takes the
// verified AdminContext as its first argument — proof the caller already
// passed requireAdminPage/requireAdminApi — and only then uses the service
// role. Nothing here is reachable from customer code paths.

export const PAGE_SIZE = 50;

/** Runtime half of the "admin context required" contract. */
function assertAdmin(ctx: AdminContext): void {
  if (!ctx?.userId || !ctx.role) throw new Error("Admin context required");
}

export interface CustomerSummary {
  tenantId: string;
  orgName: string;
  ownerEmail: string;
  ownerName: string | null;
  createdAt: string;
  memberCount: number;
  locationCount: number;
  gbpLocationCount: number;
  brokenLocationCount: number;
  locationNames: string[];
  lastSyncedAt: string | null;
  reviewCount: number;
  analyzedCount: number;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  extensionEndsAt: string | null;
  /** Latest end across the account and any location extension. */
  effectiveTrialEndsAt: string | null;
  trial: TrialState;
  trialDaysLeft: number | null;
  paid: boolean;
  lastSignInAt: string | null;
  lastEventAt: string | null;
  lastActivityAt: string | null;
  events7d: number;
  openFeedback: number;
  openBugs: number;
  lastFeedbackAt: string | null;
  isInternal: boolean;
  googleConnected: boolean;
  health: HealthStatus;
  healthReasons: string[];
}

type SummaryRow = {
  tenant_id: string; owner_email: string; owner_name: string | null; created_at: string;
  member_count: number; location_count: number; gbp_location_count: number; broken_location_count: number;
  location_names: string[]; last_synced_at: string | null; review_count: number; analyzed_count: number;
  trial_started_at: string | null; trial_ends_at: string | null; extension_ends_at: string | null;
  paid: boolean; last_sign_in_at: string | null; last_event_at: string | null; events_7d: number;
  open_feedback: number; open_bugs: number; last_feedback_at: string | null; is_internal: boolean;
  google_connected: boolean;
};

const latest = (...isos: (string | null)[]) =>
  isos.filter(Boolean).sort((a, b) => Date.parse(b!) - Date.parse(a!))[0] ?? null;

function toSummary(r: SummaryRow, now: number): CustomerSummary {
  const effective = latest(r.trial_ends_at, r.extension_ends_at);
  const lastActivity = latest(r.last_sign_in_at, r.last_event_at);
  const health = customerHealth(
    {
      locationCount: r.location_count,
      brokenLocationCount: r.broken_location_count,
      lastActivityAt: lastActivity,
      createdAt: r.created_at,
      trialEndsAt: effective,
      paid: r.paid,
      openBugs: r.open_bugs,
    },
    now
  );
  return {
    tenantId: r.tenant_id,
    orgName: r.location_names.length ? restaurantDisplayName(r.location_names) : r.owner_email,
    ownerEmail: r.owner_email,
    ownerName: r.owner_name,
    createdAt: r.created_at,
    memberCount: r.member_count,
    locationCount: r.location_count,
    gbpLocationCount: r.gbp_location_count,
    brokenLocationCount: r.broken_location_count,
    locationNames: r.location_names,
    lastSyncedAt: r.last_synced_at,
    reviewCount: Number(r.review_count),
    analyzedCount: Number(r.analyzed_count),
    trialStartedAt: r.trial_started_at,
    trialEndsAt: r.trial_ends_at,
    extensionEndsAt: r.extension_ends_at,
    effectiveTrialEndsAt: effective,
    trial: trialState(effective, r.paid, now),
    trialDaysLeft: effective ? trialDaysLeft(effective, now) : null,
    paid: r.paid,
    lastSignInAt: r.last_sign_in_at,
    lastEventAt: r.last_event_at,
    lastActivityAt: lastActivity,
    events7d: Number(r.events_7d),
    openFeedback: r.open_feedback,
    openBugs: r.open_bugs,
    lastFeedbackAt: r.last_feedback_at,
    isInternal: r.is_internal,
    googleConnected: r.google_connected,
    health: health.status,
    healthReasons: health.reasons,
  };
}

export async function getCustomerSummaries(ctx: AdminContext): Promise<CustomerSummary[]> {
  assertAdmin(ctx);
  const { data, error } = await createServiceClient().rpc("admin_customer_summaries");
  if (error) throw new Error(`admin_customer_summaries: ${error.message}`);
  const now = Date.now();
  return ((data ?? []) as SummaryRow[]).map((r) => toSummary(r, now));
}

export interface CustomerFilters {
  q?: string;
  trial?: string;
  health?: string;
  activity?: string;
  internal?: string;
  sort?: string;
}

/** Filtering/sorting over the per-account summaries (one aggregated row per account). */
export function filterCustomers(rows: CustomerSummary[], f: CustomerFilters, now: number = Date.now()): CustomerSummary[] {
  const q = f.q?.trim().toLowerCase();
  let out = rows.filter((c) => {
    if (f.internal !== "include" && c.isInternal) return false;
    if (q && ![c.orgName, c.ownerEmail, c.ownerName ?? "", ...c.locationNames].some((s) => s.toLowerCase().includes(q))) return false;
    if (f.trial && f.trial !== "all" && c.trial !== f.trial) return false;
    if (f.health && f.health !== "all" && c.health !== f.health) return false;
    if (f.activity === "active7" && !(c.lastActivityAt && now - Date.parse(c.lastActivityAt) <= 7 * 864e5)) return false;
    if (f.activity === "inactive14" && c.lastActivityAt && now - Date.parse(c.lastActivityAt) <= 14 * 864e5) return false;
    return true;
  });
  const t = (iso: string | null) => (iso ? Date.parse(iso) : 0);
  const sorters: Record<string, (a: CustomerSummary, b: CustomerSummary) => number> = {
    newest: (a, b) => t(b.createdAt) - t(a.createdAt),
    oldest: (a, b) => t(a.createdAt) - t(b.createdAt),
    most_active: (a, b) => b.events7d - a.events7d || t(b.lastActivityAt) - t(a.lastActivityAt),
    least_active: (a, b) => t(a.lastActivityAt) - t(b.lastActivityAt),
    trial_ending: (a, b) => (a.effectiveTrialEndsAt ? t(a.effectiveTrialEndsAt) : Infinity) - (b.effectiveTrialEndsAt ? t(b.effectiveTrialEndsAt) : Infinity),
    recent_login: (a, b) => t(b.lastSignInAt) - t(a.lastSignInAt),
    recent_feedback: (a, b) => t(b.lastFeedbackAt) - t(a.lastFeedbackAt),
    locations: (a, b) => b.locationCount - a.locationCount,
  };
  out = [...out].sort(sorters[f.sort ?? "newest"] ?? sorters.newest);
  return out;
}

export interface DirectoryUser {
  user_id: string;
  email: string;
  full_name: string | null;
  tenant_id: string | null;
  team_role: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  provider: string;
  admin_role: string | null;
  total_count: number;
}

export async function listUsers(
  ctx: AdminContext,
  opts: { q?: string; tenantId?: string; page?: number; pageSize?: number }
): Promise<{ rows: DirectoryUser[]; total: number }> {
  assertAdmin(ctx);
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const { data, error } = await createServiceClient().rpc("admin_user_directory", {
    p_search: opts.q?.trim() || null,
    p_tenant: opts.tenantId ?? null,
    p_limit: pageSize,
    p_offset: Math.max(0, (opts.page ?? 1) - 1) * pageSize,
  });
  if (error) throw new Error(`admin_user_directory: ${error.message}`);
  const rows = (data ?? []) as DirectoryUser[];
  return { rows, total: rows[0] ? Number(rows[0].total_count) : 0 };
}

export function isBanned(u: Pick<DirectoryUser, "banned_until">, now: number = Date.now()): boolean {
  return !!u.banned_until && Date.parse(u.banned_until) > now;
}

export interface EventRow {
  id: number;
  created_at: string;
  tenant_id: string | null;
  user_id: string | null;
  location_id: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  impersonation_session_id: string | null;
}

export async function listEvents(
  ctx: AdminContext,
  opts: { tenantId?: string; type?: string; page?: number; pageSize?: number }
): Promise<{ rows: EventRow[]; total: number }> {
  assertAdmin(ctx);
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const from = Math.max(0, (opts.page ?? 1) - 1) * pageSize;
  let q = createServiceClient()
    .from("product_events")
    .select("id, created_at, tenant_id, user_id, location_id, event_type, metadata, impersonation_session_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  if (opts.type && opts.type !== "all") q = q.eq("event_type", opts.type);
  const { data, count, error } = await q;
  if (error) throw new Error(`product_events: ${error.message}`);
  return { rows: (data ?? []) as EventRow[], total: count ?? 0 };
}

/** user_id → email for a page of rows (one query, no N+1). */
export async function emailsFor(ctx: AdminContext, userIds: (string | null)[]): Promise<Record<string, string>> {
  assertAdmin(ctx);
  const ids = [...new Set(userIds.filter(Boolean))] as string[];
  if (ids.length === 0) return {};
  const { data } = await createServiceClient().from("profiles").select("id, email").in("id", ids);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.email]));
}

export interface FeedbackRow {
  id: string;
  tenant_id: string;
  user_id: string | null;
  user_email: string | null;
  location_id: string | null;
  type: string;
  subject: string;
  message: string;
  rating: number | null;
  status: string;
  priority: string | null;
  route: string | null;
  context: Record<string, unknown>;
  impersonation_session_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export async function listFeedback(
  ctx: AdminContext,
  opts: { status?: string; type?: string; q?: string; tenantId?: string; sort?: string; page?: number; pageSize?: number }
): Promise<{ rows: FeedbackRow[]; total: number }> {
  assertAdmin(ctx);
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const from = Math.max(0, (opts.page ?? 1) - 1) * pageSize;
  let q = createServiceClient()
    .from("feedback")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: opts.sort === "oldest" })
    .range(from, from + pageSize - 1);
  if (opts.status === "open") q = q.in("status", ["new", "in_review"]);
  else if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
  if (opts.type && opts.type !== "all") q = q.eq("type", opts.type);
  if (opts.tenantId) q = q.eq("tenant_id", opts.tenantId);
  const term = opts.q?.trim().replace(/[%,()]/g, " ");
  if (term) q = q.or(`subject.ilike.%${term}%,user_email.ilike.%${term}%,message.ilike.%${term}%`);
  const { data, count, error } = await q;
  if (error) throw new Error(`feedback: ${error.message}`);
  return { rows: (data ?? []) as FeedbackRow[], total: count ?? 0 };
}

export async function getFeedback(ctx: AdminContext, id: string) {
  assertAdmin(ctx);
  const service = createServiceClient();
  const [{ data: item }, { data: notes }] = await Promise.all([
    service.from("feedback").select("*").eq("id", id).maybeSingle(),
    service.from("feedback_notes").select("*").eq("feedback_id", id).order("created_at"),
  ]);
  return { item: item as FeedbackRow | null, notes: notes ?? [] };
}

export async function getCustomerDetail(ctx: AdminContext, tenantId: string) {
  assertAdmin(ctx);
  const service = createServiceClient();
  const summaries = await getCustomerSummaries(ctx);
  const summary = summaries.find((s) => s.tenantId === tenantId) ?? null;
  if (!summary) return null;

  const [users, { data: locations }, { data: notes }, { data: auditRows }, { data: impersonations }, { data: sessions }, { data: tokenRow }] =
    await Promise.all([
      listUsers(ctx, { tenantId, pageSize: 200 }),
      service
        .from("locations")
        .select("id, tenant_id, google_location_id, name, address, rating, review_count, connection_broken, connection_broken_at, last_synced_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at"),
      service.from("account_notes").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
      service.from("admin_audit_log").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
      service.from("impersonation_sessions").select("id, admin_email, target_email, reason, started_at, expires_at, ended_at, end_reason").eq("target_tenant_id", tenantId).order("started_at", { ascending: false }).limit(50),
      service.rpc("admin_user_sessions", { p_tenant: tenantId }),
      // Only whether Google is connected and when — never the tokens themselves.
      service.from("google_tokens").select("updated_at, scope").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

  const trial = await getTrialStatus(service, tenantId, locations ?? []);
  const { data: reviewCounts } = await service.rpc("admin_location_review_counts", { p_tenant: tenantId });

  return {
    summary,
    users: users.rows,
    locations: locations ?? [],
    locationReviewCounts: Object.fromEntries(
      ((reviewCounts ?? []) as { location_id: string; reviews: number; analyzed: number }[]).map((r) => [r.location_id, r])
    ) as Record<string, { reviews: number; analyzed: number }>,
    trial,
    notes: notes ?? [],
    audit: auditRows ?? [],
    impersonations: impersonations ?? [],
    sessions: (sessions ?? []) as { user_id: string; email: string; created_at: string; refreshed_at: string | null; aal: string; ip: string | null; user_agent: string | null }[],
    google: tokenRow ? { connectedAt: tokenRow.updated_at as string, scope: tokenRow.scope as string | null } : null,
  };
}

export async function listAudit(ctx: AdminContext, opts: { page?: number; action?: string; pageSize?: number }) {
  assertAdmin(ctx);
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const from = Math.max(0, (opts.page ?? 1) - 1) * pageSize;
  let q = createServiceClient()
    .from("admin_audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (opts.action && opts.action !== "all") q = q.like("action", `${opts.action}%`);
  const { data, count, error } = await q;
  if (error) throw new Error(`admin_audit_log: ${error.message}`);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function getSystemHealth(ctx: AdminContext) {
  assertAdmin(ctx);
  const service = createServiceClient();
  const started = Date.now();
  const [{ data: health, error }, { data: errors24 }, { data: recentErrors }] = await Promise.all([
    service.rpc("admin_system_health"),
    service.from("app_errors").select("category").gte("created_at", new Date(Date.now() - 864e5).toISOString()).limit(5000),
    service.from("app_errors").select("*").order("created_at", { ascending: false }).limit(50),
  ]);
  const byCategory: Record<string, number> = {};
  for (const e of errors24 ?? []) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  return {
    dbOk: !error,
    dbLatencyMs: Date.now() - started,
    health: (health ?? {}) as {
      db_time?: string;
      cron_jobs?: { job: string; schedule: string; active: boolean; last_run: string | null; last_status: string | null; failures_24h: number }[];
      http_calls_24h?: { total: number; failed: number; timed_out: number };
      pending_analysis?: number;
      broken_locations?: number;
      stale_locations?: number;
      open_impersonations?: number;
    },
    errorsByCategory24h: byCategory,
    recentErrors: recentErrors ?? [],
    // Configuration presence only — never values.
    config: {
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      resend: !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM,
      google: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
      cronSecret: !!process.env.CRON_SECRET,
      tokenEncryption: !!process.env.TOKEN_ENCRYPTION_KEY,
    },
    deployment: {
      env: process.env.VERCEL_ENV ?? "unknown",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
  };
}
