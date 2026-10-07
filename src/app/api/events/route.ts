import { NextResponse } from "next/server";
import { getCaller } from "@/lib/telemetry/caller";
import { recordEvent } from "@/lib/telemetry/server";
import { isClientEventType } from "@/lib/telemetry/sanitize";

// Product events from the signed-in customer app. The event type must be on
// the client allowlist; metadata is reduced to allowlisted short fields; the
// user, tenant and impersonation flag come from the session, never the body.
export async function POST(request: Request) {
  const text = await request.text().catch(() => "");
  if (text.length > 4000) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: { type?: unknown; metadata?: unknown } = {};
  try {
    body = JSON.parse(text || "{}");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!isClientEventType(body.type)) return NextResponse.json({ error: "Unknown event" }, { status: 400 });

  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const metadata = (body.metadata && typeof body.metadata === "object" ? body.metadata : {}) as Record<string, unknown>;
  const locationId = typeof metadata.location_id === "string" && /^[0-9a-f-]{36}$/i.test(metadata.location_id) ? metadata.location_id : null;
  await recordEvent({
    type: body.type,
    tenantId: caller.tenantId,
    userId: caller.userId,
    locationId,
    metadata,
    impersonationSessionId: caller.impersonationSessionId,
  });
  return new NextResponse(null, { status: 204 });
}
