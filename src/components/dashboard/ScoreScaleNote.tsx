import { Info } from "lucide-react";

/**
 * Shared explainer for the AI sentiment scale — shown once near the top
 * of any page that leans on it (Overview, Reports) so a reader always
 * has the context before they hit their first score, instead of having
 * to infer it from a chart legend.
 */
export default function ScoreScaleNote() {
  return (
    <div className="rounded-2xl bg-cream border border-line-soft px-4 py-3 flex items-start gap-2.5">
      <Info className="w-4 h-4 text-ink-faint shrink-0 mt-0.5" />
      <p className="text-xs text-ink-soft leading-relaxed">
        <strong className="text-ink font-semibold">How to read these scores:</strong>{" "}
        every number is an AI sentiment rating from <strong className="text-neg">−1.0</strong>{" "}
        (very negative) to <strong className="text-pos">+1.0</strong> (very positive) — not a
        star rating. It&apos;s the average across only the reviews that mentioned that specific
        topic, from the batch of reviews currently synced into this system, which may be a
        smaller sample than the location&apos;s full Google review history.
      </p>
    </div>
  );
}
