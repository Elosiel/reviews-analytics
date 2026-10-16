/**
 * GET /api/preview/report?place_id=…  (public, no auth)
 * Builds/returns the cached one-page public-reviews preview report.
 */
import { NextResponse } from "next/server";
import { guardedReport } from "@/lib/preview-report/guard";

export const maxDuration = 60;

export async function GET(request: Request) {
  const r = await guardedReport(request);
  if ("response" in r) return r.response;
  return NextResponse.json({ report: r.report }, { headers: { "Cache-Control": "private, max-age=300" } });
}
