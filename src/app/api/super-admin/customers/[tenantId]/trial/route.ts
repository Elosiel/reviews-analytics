import { NextResponse } from "next/server";
import { audit, requireAdminApi } from "@/lib/admin/auth";
import { readJson, UUID_RE } from "@/lib/admin/api";
import { createServiceClient } from "@/lib/supabase/service";

// Changes an account's own trial end (tenant_trials). Location extensions
// (trial_extensions, e.g. Terra Gaucha Tampa) are deliberately untouched.
export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const admin = await requireAdminApi("manage_trials");
  if (admin instanceof NextResponse) return admin;
  const { tenantId } = await params;
  if (!UUID_RE.test(tenantId)) return NextResponse.json({ error: "Invalid account" }, { status: 400 });
  const body = await readJson(request);
  if (body.confirm !== "CHANGE TRIAL") return NextResponse.json({ error: "Type CHANGE TRIAL to confirm." }, { status: 400 });
  const endsAt = typeof body.trial_ends_at === "string" ? Date.parse(body.trial_ends_at) : NaN;
  if (!Number.isFinite(endsAt)) return NextResponse.json({ error: "Pick a valid date." }, { status: 400 });

  const service = createServiceClient();
  const { data: current } = await service.from("tenant_trials").select("trial_started_at, trial_ends_at").eq("tenant_id", tenantId).maybeSingle();
  if (!current) return NextResponse.json({ error: "This account has no trial record." }, { status: 404 });
  if (endsAt <= Date.parse(current.trial_started_at)) return NextResponse.json({ error: "The end must be after the trial start." }, { status: 400 });
  if (endsAt > Date.now() + 2 * 365 * 864e5) return NextResponse.json({ error: "That's more than two years out — check the date." }, { status: 400 });

  const newEnds = new Date(endsAt).toISOString();
  const { error } = await service.from("tenant_trials").update({ trial_ends_at: newEnds }).eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: "Couldn't update the trial." }, { status: 500 });
  await audit(admin, "trial.changed", { type: "account", id: tenantId, tenantId, details: { from: current.trial_ends_at, to: newEnds } });
  return NextResponse.json({ ok: true });
}
