"use client";

import { ArrowRight, MapPin } from "lucide-react";
import type { Location, SentimentCategory, MatrixCell } from "@/types";
import { CATEGORY_LABELS, fmtScore } from "@/lib/design";

interface WeakestLinkSpotlightProps {
  location: Location;
  worstCategory: SentimentCategory;
  cell: MatrixCell;
  openIssueCount: number;
  topQuote: string;
  onReview: () => void;
}

/**
 * The urgency card: the worst-performing location, named, with its worst
 * category and the momentum. One clear action. This is why the owner
 * opens the app on a Tuesday.
 */
export default function WeakestLinkSpotlight({
  location,
  worstCategory,
  cell,
  openIssueCount,
  topQuote,
  onReview,
}: WeakestLinkSpotlightProps) {
  return (
    <div className="rounded-2xl bg-[#33150e] text-[#f8ece7] p-6 flex flex-col relative overflow-hidden">
      {/* subtle heat glow */}
      <div
        className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-25 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, #e05c3f 0%, transparent 70%)",
        }}
      />
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#ff7a5c] animate-pulse" />
        <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[#e8a38e]">
          Needs you most this week
        </p>
      </div>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-[26px] leading-tight font-semibold">
            {location.name}
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-[#d9a795] mt-1">
            <MapPin className="w-3 h-3" />
            {location.address}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold tabular-nums">
            {location.rating?.toFixed(1)}
            <span className="text-[#e8a38e] text-lg">★</span>
          </p>
          <p className="text-[11px] text-[#d9a795]">
            lowest in the group
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#48211a] border border-[#6b3325] p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-semibold">
            {CATEGORY_LABELS[worstCategory]} is the problem
          </p>
          <p className="text-sm font-bold tabular-nums text-[#ffb09a]">
            {fmtScore(cell.score)}
            <span className="text-xs font-semibold ml-2">
              ▼ {fmtScore(cell.delta)} in 30 days
            </span>
          </p>
        </div>
        <blockquote className="mt-2 text-[13px] text-[#e8c4b5] italic border-l-2 border-[#a35139] pl-3 leading-relaxed">
          &ldquo;{topQuote}&rdquo;
        </blockquote>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-[#d9a795]">
          {cell.mentions} guests mentioned it · {openIssueCount} open issue
          {openIssueCount !== 1 ? "s" : ""} here
        </p>
        <button
          onClick={onReview}
          className="inline-flex items-center gap-1.5 bg-[#f8ece7] text-[#33150e] text-[13px] font-semibold rounded-xl px-4 py-2.5 hover:bg-white transition-colors"
        >
          See the fix plan
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
