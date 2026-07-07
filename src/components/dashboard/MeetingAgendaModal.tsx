"use client";

import { useState } from "react";
import { X, Printer, Copy, Check, Sparkles, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, fmtScore, SEVERITY_STYLE } from "@/lib/design";
import { copyBriefText, openPrintWindow, todayLabel } from "@/lib/export-brief";
import type { Meeting, MeetingQuoteSnapshot, Sop } from "@/types";

interface MeetingAgendaModalProps {
  meeting: Meeting;
  quotes: MeetingQuoteSnapshot[];
  sops: Sop[];
  onClose: () => void;
}

export default function MeetingAgendaModal({
  meeting,
  quotes,
  sops,
  onClose,
}: MeetingAgendaModalProps) {
  const [copied, setCopied] = useState(false);
  const sopById = new Map(sops.map((s) => [s.id, s]));

  function quotesFor(locationId: string, category: string) {
    return quotes.filter((q) => q.location_id === locationId && q.category === category);
  }

  const plainText = `
MEETING AGENDA — ${meeting.title}
Generated ${new Date(meeting.generated_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · Reviews Analytics

${meeting.agenda
  .map((item, i) => {
    const linkedSop = item.linked_sop_id ? sopById.get(item.linked_sop_id) : undefined;
    const itemQuotes = quotesFor(item.location_id, item.category);
    return `${i + 1}. ${CATEGORY_LABELS[item.category].toUpperCase()} — ${item.location_name}
Mentions (30d): ${item.mention_count} · Sentiment: ${item.avg_sentiment_score.toFixed(2)}${item.sentiment_delta !== null ? ` (${item.sentiment_delta > 0 ? "+" : ""}${item.sentiment_delta.toFixed(2)} vs prior)` : ""}

Discuss: ${item.discussion_point}
Action: ${item.suggested_action}${linkedSop ? `\nLinked SOP: ${linkedSop.title}` : ""}
${itemQuotes.length ? `\nGuest quotes:\n${itemQuotes.map((q) => `- "${q.quote_text ?? "[quote no longer available — past 30 days]"}"`).join("\n")}` : ""}`;
  })
  .join("\n\n")}
  `.trim();

  async function handleCopy() {
    await copyBriefText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    const bodyHtml = `
      <h1>Meeting Agenda — ${meeting.title}</h1>
      <div class="meta">${todayLabel()} · Reviews Analytics</div>
      ${meeting.agenda
        .map((item) => {
          const linkedSop = item.linked_sop_id ? sopById.get(item.linked_sop_id) : undefined;
          const itemQuotes = quotesFor(item.location_id, item.category);
          return `
          <div class="item">
            <h2>${CATEGORY_LABELS[item.category]} — ${item.location_name}</h2>
            <div class="value">${item.mention_count} mentions (30d) · Score ${item.avg_sentiment_score.toFixed(2)}</div>
            <div class="label">Discuss</div>
            <div class="value">${item.discussion_point}</div>
            ${itemQuotes.map((q) => `<blockquote>"${q.quote_text ?? "[quote no longer available — past 30 days]"}"</blockquote>`).join("")}
            <div class="recommendation">
              <div class="label">Suggested action</div>
              <p>${item.suggested_action}</p>
              ${linkedSop ? `<p style="margin-top:8px;font-size:12px;color:#71717a;">Linked SOP: ${linkedSop.title}</p>` : ""}
            </div>
          </div>`;
        })
        .join("")}
    `;
    openPrintWindow(`Meeting Agenda — ${meeting.title}`, bodyHtml);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-xl border border-line max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-line-soft">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-0.5 font-medium">
              Meeting Agenda
            </p>
            <h2 className="font-heading text-lg font-semibold text-ink">{meeting.title}</h2>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink shrink-0 ml-3">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {meeting.agenda.map((item, i) => {
            const linkedSop = item.linked_sop_id ? sopById.get(item.linked_sop_id) : undefined;
            const itemQuotes = quotesFor(item.location_id, item.category);
            return (
              <div key={`${item.category}-${item.location_id}-${i}`} className="pb-5 border-b border-line-soft last:border-0 last:pb-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="font-heading text-base font-semibold text-ink">
                    {CATEGORY_LABELS[item.category]} — {item.location_name}
                  </span>
                  {item.severity && (
                    <span
                      className={`text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${SEVERITY_STYLE[item.severity].badge}`}
                    >
                      {SEVERITY_STYLE[item.severity].label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap text-xs text-ink-faint mb-3">
                  <span>{item.mention_count} mentions (30d)</span>
                  <span className="font-semibold tabular-nums text-ink-soft">
                    {fmtScore(item.avg_sentiment_score)}
                  </span>
                  {item.sentiment_delta !== null && (
                    <span className={item.sentiment_delta < 0 ? "text-neg" : "text-pos"}>
                      {item.sentiment_delta < 0 ? "▼" : "▲"} {fmtScore(item.sentiment_delta)} vs prior
                    </span>
                  )}
                </div>

                <p className="text-sm text-ink-soft leading-relaxed mb-2">{item.discussion_point}</p>

                {itemQuotes.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {itemQuotes.map((q) => (
                      <blockquote key={q.id} className="border-l-2 border-line pl-3 text-sm text-ink-soft italic">
                        &ldquo;{q.quote_text ?? "Quote no longer available — past the 30-day window"}&rdquo;
                      </blockquote>
                    ))}
                  </div>
                )}

                <div className="rounded-xl bg-[#f0f4ee] border border-forest/15 p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-forest" />
                    <p className="text-[11px] font-semibold text-forest uppercase tracking-[0.14em]">
                      Suggested action
                    </p>
                  </div>
                  <p className="text-sm text-[#2c3d2f] leading-relaxed">{item.suggested_action}</p>
                  {linkedSop && (
                    <p className="flex items-center gap-1 text-xs text-forest mt-2">
                      <ClipboardList className="w-3 h-3" /> Linked SOP: {linkedSop.title}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2 border-t border-line-soft pt-4">
          <Button variant="outline" onClick={handleCopy} className="flex-1 gap-2">
            {copied ? (
              <>
                <Check className="w-4 h-4 text-pos" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" /> Copy text
              </>
            )}
          </Button>
          <Button onClick={handlePrint} className="flex-1 bg-forest hover:bg-forest-soft text-paper gap-2">
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
