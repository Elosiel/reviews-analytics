/** GET /api/preview/report/pdf?place_id=… — public PDF of the preview report. */
import { NextResponse } from "next/server";
import { guardedReport } from "@/lib/preview-report/guard";
import { buildPreviewReportHtml, previewReportFileName } from "@/lib/preview-report/html";
import { renderReportPdf } from "@/lib/reports/render-report-pdf";

export const maxDuration = 60;

export async function GET(request: Request) {
  const r = await guardedReport(request);
  if ("response" in r) return r.response;
  try {
    const pdf = await renderReportPdf(buildPreviewReportHtml(r.report));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${previewReportFileName(r.report)}"`,
      },
    });
  } catch (e) {
    console.error("preview-report pdf failed:", e);
    return NextResponse.json({ error: "PDF rendering failed" }, { status: 500 });
  }
}
