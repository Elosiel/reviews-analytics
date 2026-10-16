import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/preview-report/rate-limit";
import { getPreviewReport, PLACE_ID_RE, type PreviewReport } from "@/lib/preview-report/build";

/** Shared validation + rate limiting + error mapping for the public report routes. */
export async function guardedReport(
  request: Request
): Promise<{ report: PreviewReport } | { response: NextResponse }> {
  const placeId = new URL(request.url).searchParams.get("place_id")?.trim() ?? "";
  if (!PLACE_ID_RE.test(placeId)) {
    return { response: NextResponse.json({ error: "Invalid place_id" }, { status: 400 }) };
  }
  const ip = clientIp(request);
  // 10 report requests / 10 min per IP; 300 / hour per instance overall.
  const perIp = rateLimit(`ip:${ip}`, 10, 10 * 60 * 1000);
  const global = rateLimit("global", 300, 60 * 60 * 1000);
  if (!perIp.ok || !global.ok) {
    const retry = !perIp.ok ? perIp.retryAfterSec : !global.ok ? global.retryAfterSec : 60;
    return {
      response: NextResponse.json(
        { error: "Too many report requests — please try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(retry) } }
      ),
    };
  }
  try {
    return { report: await getPreviewReport(placeId) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("preview-report failed:", msg);
    if (msg === "PLACES_KEY_MISSING") {
      return { response: NextResponse.json({ error: "Live preview isn't configured on this deployment." }, { status: 503 }) };
    }
    if (msg.startsWith("Places API error 4")) {
      return { response: NextResponse.json({ error: "We couldn't find that restaurant on Google." }, { status: 404 }) };
    }
    return { response: NextResponse.json({ error: "We couldn't build this report right now. Please try again." }, { status: 502 }) };
  }
}
