"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/design";
import type { Sop, SopStatus } from "@/types";

export const SOP_STATUS_STYLE: Record<SopStatus, { label: string; badge: string }> = {
  active: { label: "Active", badge: "bg-[#eef6f1] text-pos" },
  draft: { label: "Needs your review", badge: "bg-[#fbeeea] text-neg" },
  archived: { label: "Archived", badge: "bg-line-soft text-ink-faint" },
};

interface SopCardProps {
  sop: Sop;
  onOpen: () => void;
}

export default function SopCard({ sop, onOpen }: SopCardProps) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left bg-paper rounded-2xl border p-5 transition-all hover:border-ink-faint",
        sop.status === "draft" ? "border-neg/25" : "border-line"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {CATEGORY_LABELS[sop.category]}
            </span>
            <span
              className={cn(
                "text-[11px] font-semibold rounded-full px-2 py-0.5",
                SOP_STATUS_STYLE[sop.status].badge
              )}
            >
              {SOP_STATUS_STYLE[sop.status].label}
            </span>
            {sop.ai_generated && (
              <span className="flex items-center gap-1 text-[11px] text-ink-faint">
                <Sparkles className="w-3 h-3" /> AI drafted
              </span>
            )}
          </div>
          <p className="font-heading text-base font-semibold text-ink">{sop.title}</p>
          {sop.source_summary && (
            <p className="text-xs text-ink-faint">{sop.source_summary}</p>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-ink-faint shrink-0 mt-1" />
      </div>
    </button>
  );
}
