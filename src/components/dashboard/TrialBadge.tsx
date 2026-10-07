import { cn } from "@/lib/utils";
import { trialDaysLeft } from "@/lib/billing/trial";

function fmtTrialDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** One location's free-trial countdown. Green, amber in the last week, red once ended. */
export default function TrialBadge({ endsAt }: { endsAt: string }) {
  const days = trialDaysLeft(endsAt);
  const label = days === 0 ? "Free trial ended" : `Free trial · ${days} day${days === 1 ? "" : "s"} left`;
  return (
    <p
      title={`${days === 0 ? "Ended" : "Ends"} ${fmtTrialDate(endsAt)}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        days === 0
          ? "bg-[#fbeeea] text-neg"
          : days <= 7
            ? "bg-[#f4dbb1] text-[#5c430e]"
            : "bg-[#eef6f1] text-forest"
      )}
    >
      <span
        aria-hidden="true"
        className={cn("h-1.5 w-1.5 rounded-full", days === 0 ? "bg-neg" : days <= 7 ? "bg-gold" : "bg-pos")}
      />
      {label}
      <span className="font-normal opacity-80">{` · ${days === 0 ? "" : "until "}${fmtTrialDate(endsAt)}`}</span>
    </p>
  );
}
