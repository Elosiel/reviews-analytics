/** Print/PDF template for the preview report. All dynamic text is escaped. */
import type { PreviewReport } from "@/lib/preview-report/build";

export const CATEGORY_LABEL: Record<string, string> = {
  food: "Food", service: "Service", atmosphere: "Atmosphere",
  value: "Value", wait_time: "Wait time", cleanliness: "Cleanliness",
};
export const RISK_LABEL: Record<string, string> = {
  health_safety: "Health & food safety", legal: "Legal",
  discrimination: "Discrimination", physical_safety: "Physical safety",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fmt = (n: number) => (n > 0 ? "+" : "") + n.toFixed(1);

export function previewReportFileName(r: PreviewReport) {
  return `reviews-preview-${r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "restaurant"}.pdf`;
}

export function buildPreviewReportHtml(r: PreviewReport): string {
  const item = (i: { title: string; detail: string; category: string }) =>
    `<li><b>${esc(i.title)}</b> <span class="tag">${esc(CATEGORY_LABEL[i.category] ?? i.category)}</span><br>${esc(i.detail)}</li>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:Helvetica,Arial,sans-serif;color:#1d1a14;margin:0;font-size:12px;line-height:1.45}
  h1{font-size:22px;margin:0} h2{font-size:14px;margin:18px 0 6px;color:#17402f}
  .sub{color:#5f594c} .tag{font-size:10px;background:#eef6f1;color:#17402f;border-radius:8px;padding:1px 6px}
  table{width:100%;border-collapse:collapse} td,th{border-bottom:1px solid #e9e3d2;padding:5px;text-align:left;vertical-align:top}
  .neg{color:#b42318} .pos{color:#17402f} ul{padding-left:18px} li{margin-bottom:6px}
  .note{font-size:10px;color:#97907f;border-top:1px solid #e9e3d2;padding-top:8px;margin-top:18px}
  </style></head><body>
  <h1>${esc(r.name)}</h1>
  <div class="sub">${esc(r.address)} · Google rating ${r.rating ?? "–"}★ (${r.total_reviews} reviews)</div>
  <div class="sub">Public-reviews preview · based on ${r.reviews_analyzed} of ${r.total_reviews} reviews</div>
  <h2>Top fixes</h2>${r.top_fixes.length ? `<ul>${r.top_fixes.map(item).join("")}</ul>` : `<p class="sub">No clear complaints in the public sample.</p>`}
  <h2>What guests love</h2>${r.strengths.length ? `<ul>${r.strengths.map(item).join("")}</ul>` : `<p class="sub">No clear praise themes in the public sample.</p>`}
  <h2>Themes</h2>${r.themes.length ? `<table><tr><th>Category</th><th>Mentions</th><th>Sentiment</th><th>Example</th></tr>${r.themes
    .map((t) => `<tr><td>${esc(CATEGORY_LABEL[t.category])}</td><td>${t.mentions} of ${r.reviews_analyzed}</td><td class="${t.avg_sentiment < 0 ? "neg" : "pos"}">${fmt(t.avg_sentiment)}</td><td>${t.quotes[0] ? `“${esc(t.quotes[0].text)}” (${t.quotes[0].stars}★)` : ""}</td></tr>`)
    .join("")}</table>` : `<p class="sub">Not enough review text to group into themes.</p>`}
  <h2>Risks</h2>${r.risks.length ? `<ul>${r.risks.map((k) => `<li><b>${esc(RISK_LABEL[k.flag])}</b>: ${k.count} review(s) — “${esc(k.quotes[0] ?? "")}”</li>`).join("")}</ul>` : `<p class="sub">No health, legal, discrimination or safety flags in the public sample.</p>`}
  <div class="note">Google's public API shows only a handful of recent or "most relevant" reviews per place, so this is a snapshot, not a trend. The full Reviews Analytics report reads every review across every location, ranked by what's costing you stars — $89/location/month. reviewsanalytics.ai · Generated ${esc(r.generated_at.slice(0, 10))}</div>
  </body></html>`;
}
