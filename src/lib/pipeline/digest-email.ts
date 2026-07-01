/**
 * Weekly digest email renderer.
 *
 * Spec rules:
 * - Styled HTML email — ranked list + signed deltas + color coding.
 * - NO embedded chart images (v1) — charts are in the dashboard, email is the hook.
 * - Links back to dashboard and to shift meeting card for top issue.
 * - Sent via Resend.
 * - Monday 07:00 UTC — no per-tenant timezone in v1.
 */

import { Resend } from "resend";
import type { SentimentCategory } from "@/types";

// Lazily instantiated — Resend's constructor throws if the key is missing,
// which would crash module load (and the build) before .env.local is set up.
let resend: Resend | null = null;
function getResendClient(): Resend {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const CATEGORY_LABELS: Record<SentimentCategory, string> = {
  food: "Food Quality",
  service: "Service",
  atmosphere: "Atmosphere",
  value: "Value",
  wait_time: "Wait Time",
  cleanliness: "Cleanliness",
};

interface DigestIssue {
  category: SentimentCategory;
  location_name: string;
  mention_count: number;
  avg_sentiment_score: number;
  sentiment_delta: number | null;
  severity: "high" | "medium" | "low" | null;
}

interface DigestLove {
  category: SentimentCategory;
  location_name: string;
  mention_count: number;
  avg_sentiment_score: number;
}

interface DigestData {
  tenant_email: string;
  tenant_name: string;
  week_ending: string;
  issues: DigestIssue[];
  loves: DigestLove[];
  app_url: string;
}

function scoreColor(score: number): string {
  if (score >= 0.2) return "#10b981";
  if (score >= -0.1) return "#f59e0b";
  return "#ef4444";
}

function deltaStr(delta: number | null): string {
  if (delta === null) return "";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}`;
}

function deltaColor(delta: number | null): string {
  if (delta === null) return "#a1a1aa";
  if (delta > 0) return "#10b981";
  if (delta < -0.1) return "#ef4444";
  return "#f59e0b";
}

function severityBadge(severity: string | null): string {
  if (!severity) return "";
  const colors: Record<string, string> = {
    high: "background:#fef2f2;color:#b91c1c;",
    medium: "background:#fffbeb;color:#b45309;",
    low: "background:#f4f4f5;color:#52525b;",
  };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;${colors[severity] ?? ""}">${severity}</span>`;
}

export function buildDigestHtml(data: DigestData): string {
  const issueRows = data.issues
    .slice(0, 5)
    .map(
      (issue, i) => `
    <tr style="border-bottom:1px solid #f4f4f5;">
      <td style="padding:14px 0;width:28px;color:#a1a1aa;font-size:13px;font-weight:600;">${i + 1}</td>
      <td style="padding:14px 8px;">
        <div style="font-weight:600;color:#18181b;font-size:14px;">${CATEGORY_LABELS[issue.category]}</div>
        <div style="color:#71717a;font-size:12px;margin-top:2px;">${issue.location_name} · ${issue.mention_count} mentions</div>
      </td>
      <td style="padding:14px 8px;text-align:right;white-space:nowrap;">
        <span style="font-weight:700;color:${scoreColor(issue.avg_sentiment_score)};font-size:14px;">${issue.avg_sentiment_score > 0 ? "+" : ""}${issue.avg_sentiment_score.toFixed(2)}</span>
        ${issue.sentiment_delta !== null ? `<span style="display:block;font-size:11px;color:${deltaColor(issue.sentiment_delta)};">${deltaStr(issue.sentiment_delta)} vs prior</span>` : ""}
      </td>
      <td style="padding:14px 0 14px 12px;">${severityBadge(issue.severity)}</td>
    </tr>
  `
    )
    .join("");

  const loveRows = data.loves
    .slice(0, 3)
    .map(
      (love) => `
    <tr style="border-bottom:1px solid #f4f4f5;">
      <td style="padding:10px 8px;">
        <span style="font-weight:600;color:#18181b;font-size:13px;">${CATEGORY_LABELS[love.category]}</span>
        <span style="color:#71717a;font-size:12px;margin-left:6px;">${love.location_name}</span>
      </td>
      <td style="padding:10px 0;text-align:right;">
        <span style="font-weight:700;color:#10b981;font-size:13px;">+${love.avg_sentiment_score.toFixed(2)}</span>
        <span style="color:#a1a1aa;font-size:11px;margin-left:4px;">${love.mention_count} mentions</span>
      </td>
    </tr>
  `
    )
    .join("");

  const topIssue = data.issues[0];

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;">
        Reviews Analytics · Weekly Brief
      </div>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:#18181b;line-height:1.3;">
        Week ending ${data.week_ending}
      </h1>
      <p style="margin:6px 0 0;color:#71717a;font-size:14px;">
        Here's what your guests are saying — and what needs your attention.
      </p>
    </div>

    <!-- Fix These -->
    ${data.issues.length > 0 ? `
    <div style="background:#fff;border-radius:12px;border:1px solid #e4e4e7;padding:20px 24px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa;margin-bottom:16px;">
        🔧 Fix These First
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${issueRows}
      </table>
      ${topIssue ? `
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid #f4f4f5;">
        <a href="${data.app_url}/dashboard" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;">
          View shift brief for ${CATEGORY_LABELS[topIssue.category]} →
        </a>
      </div>
      ` : ""}
    </div>
    ` : ""}

    <!-- What They Love -->
    ${data.loves.length > 0 ? `
    <div style="background:#fff;border-radius:12px;border:1px solid #e4e4e7;padding:20px 24px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#a1a1aa;margin-bottom:16px;">
        ✨ What They Love
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${loveRows}
      </table>
    </div>
    ` : ""}

    <!-- CTA -->
    <div style="background:#18181b;border-radius:12px;padding:24px;text-align:center;margin-bottom:16px;">
      <p style="margin:0 0 14px;color:#a1a1aa;font-size:13px;">
        Full trend charts, quotes, and shift cards are in your dashboard.
      </p>
      <a href="${data.app_url}/dashboard" style="display:inline-block;background:#fff;color:#18181b;text-decoration:none;padding:11px 24px;border-radius:8px;font-size:13px;font-weight:600;">
        Open Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;color:#a1a1aa;font-size:11px;line-height:1.6;">
      <p style="margin:0;">Reviews Analytics · Read-only intelligence — we never post on your behalf.</p>
      <p style="margin:4px 0 0;">
        <a href="${data.app_url}/dashboard/settings" style="color:#a1a1aa;">Manage settings</a>
        · Guest quotes shown only from rolling 30-day window per Google ToS.
      </p>
    </div>

  </div>
</body>
</html>`;
}

export async function sendDigestEmail(data: DigestData) {
  const html = buildDigestHtml(data);
  const subject = `Your weekly review brief — ${data.week_ending}`;

  const result = await getResendClient().emails.send({
    from: process.env.RESEND_FROM!,
    to: data.tenant_email,
    subject,
    html,
  });

  return result;
}
