"use client";

import { Mail } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/design";
import { MOCK_WEEK } from "@/lib/mock-data";

/**
 * The weekly digest tie-in: what lands in the owner's inbox Monday 7:00.
 * The dashboard and the email tell the same story on purpose.
 */
export default function MondayBriefCard() {
  return (
    <div className="rounded-2xl bg-forest text-paper p-6 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="w-10 h-10 rounded-full bg-paper/10 border border-paper/20 flex items-center justify-center shrink-0">
        <Mail className="w-4.5 h-4.5 text-paper" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading text-lg font-semibold">
          Your Monday brief lands at 7:00 AM
        </p>
        <p className="text-sm text-paper/70 mt-1 leading-relaxed">
          The week&apos;s three headlines, in your inbox before the doors open:
          what guests loved ({CATEGORY_LABELS[MOCK_WEEK.best.category].toLowerCase()} at{" "}
          {MOCK_WEEK.best.location}), what needs a fix (
          {CATEGORY_LABELS[MOCK_WEEK.worst.category].toLowerCase()} at{" "}
          {MOCK_WEEK.worst.location}), and how your rating moved.
        </p>
      </div>
      <div className="text-left sm:text-right shrink-0">
        <p className="text-[11px] uppercase tracking-[0.14em] text-paper/50 font-medium">
          Delivered every Monday
        </p>
        <p className="text-sm text-paper/90 mt-0.5">No login required</p>
      </div>
    </div>
  );
}
