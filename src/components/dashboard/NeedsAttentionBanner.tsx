"use client";

import { useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import type { NeedsAttentionItem } from "@/types";

const FLAG_LABELS: Record<NeedsAttentionItem["flag"], string> = {
  health_safety: "Health & safety",
  legal: "Legal",
  discrimination: "Discrimination",
  physical_safety: "Physical safety",
};

/**
 * Danger-flag reviews (health/safety, legal, discrimination, physical safety)
 * are surfaced above everything else, regardless of category or star rating.
 * This is deliberately the loudest element on the page.
 */
export default function NeedsAttentionBanner({
  items,
}: {
  items: NeedsAttentionItem[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = items.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border-2 border-neg/40 bg-[#fbeeea] p-5 flex items-start gap-4"
        >
          <div className="w-9 h-9 rounded-full bg-neg flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4.5 h-4.5 text-paper" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-heading text-base font-semibold text-[#7a1f13]">
                Needs your attention today
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide bg-neg text-paper rounded-full px-2 py-0.5">
                {FLAG_LABELS[item.flag]}
              </span>
              <span className="text-xs text-ink-faint">
                {item.location_name} · {item.star_rating}★
              </span>
            </div>
            <blockquote className="mt-2 text-sm text-[#66261a] italic border-l-2 border-neg/40 pl-3">
              &ldquo;{item.quote}&rdquo;
            </blockquote>
            <p className="mt-2 text-xs text-[#8a5347]">
              A guest reported a possible {FLAG_LABELS[item.flag].toLowerCase()}{" "}
              issue. Review it with your manager before tonight&apos;s service —
              these are flagged no matter which category they fall under.
            </p>
          </div>
          <button
            onClick={() => setDismissed((p) => new Set([...p, item.id]))}
            className="text-ink-faint hover:text-ink shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
