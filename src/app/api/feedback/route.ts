import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getCaller } from "@/lib/telemetry/caller";
import { logAppError, recordEvent } from "@/lib/telemetry/server";
import { parseFeedbackInput } from "@/lib/telemetry/sanitize";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Customer feedback / bug reports / help requests. Identity and account are
// stamped from the session; the body only supplies what the user typed plus
// the page they were on. Stored where only admins can read it.
export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = parseFeedbackInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const f = parsed.value;

  // A location id is kept only if it belongs to the caller's own account.
  let locationId: string | null = null;
  if (f.locationId) {
    const { data: loc } = await (await createClient()).from("locations").select("id").eq("id", f.locationId).maybeSingle();
    locationId = loc?.id ?? null;
  }

  const h = await headers();
  const viewport = (body as { viewport?: { w?: unknown; h?: unknown } })?.viewport;
  const context = {
    user_agent: h.get("user-agent")?.slice(0, 250) ?? null,
    viewport: viewport && Number.isFinite(Number(viewport.w)) ? `${Math.round(Number(viewport.w))}×${Math.round(Number(viewport.h))}` : null,
    app_version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    environment: process.env.VERCEL_ENV ?? null,
  };

  const { error } = await createServiceClient().from("feedback").insert({
    tenant_id: caller.tenantId,
    user_id: caller.userId,
    user_email: caller.email,
    location_id: locationId,
    type: f.type,
    subject: f.subject,
    message: f.message,
    rating: f.rating,
    route: f.route,
    context,
    impersonation_session_id: caller.impersonationSessionId,
  });
  if (error) {
    await logAppError({ category: "feedback", source: "POST /api/feedback", error, tenantId: caller.tenantId, userId: caller.userId });
    return NextResponse.json({ error: "We couldn't send that. Please try again." }, { status: 500 });
  }
  await recordEvent({
    type: "feedback_submitted",
    tenantId: caller.tenantId,
    userId: caller.userId,
    metadata: { type: f.type },
    impersonationSessionId: caller.impersonationSessionId,
  });
  return NextResponse.json({ ok: true });
}
