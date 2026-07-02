"use client";

import { ArrowRight, PartyPopper } from "lucide-react";
import type { DriftAlert } from "@/types";
import { CATEGORY_LABELS, fmtScore } from "@/lib/design";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Proof of impact — when a flagged category recovers, show the before/after
 * delta explicitly. This is the "your work paid off" moment that brings
 * owners back to the dashboard.
 */
export default function ProofOfImpactCard({
  recovery,
  locationName,
}: {
  recovery: DriftAlert;
  locationName: string;
}) {
  if (!recovery.resolved || recovery.recovery_score === null) return null;

  return (
    <div className="rounded-2xl border border-pos/25 bg-[#eef6f1] p-5">
      <div className="flex items-start gap-4">
        <div className="w-9 h-9 rounded-full bg-pos flex items-center justify-center shrink-0">
          <PartyPopper className="w-4.5 h-4.5 text-paper" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading text-base font-semibold text-[#0d3325]">
            Your work paid off — {CATEGORY_LABELS[recovery.category]} at{" "}
            {locationName} recovered
          </p>
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-paper rounded-xl border border-line px-4 py-2.5">
              <div>
                <p className="text-[11px] text-ink-faint">
                  Flagged {fmtDate(recovery.detected_at)}
                </p>
                <p className="text-lg font-bold text-neg tabular-nums">
                  {fmtScore(recovery.score_before)}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-ink-faint mx-1" />
              <div>
                <p className="text-[11px] text-ink-faint">
                  Recovered {fmtDate(recovery.recovered_at ?? recovery.detected_at)}
                </p>
                <p className="text-lg font-bold text-pos tabular-nums">
                  {fmtScore(recovery.recovery_score)}
                </p>
              </div>
            </div>
            <p className="text-sm text-[#2e5a47] max-w-xs">
              Six weeks from flag to recovery. Guests noticed — keep whatever
              you changed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
