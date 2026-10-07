import { Eye } from "lucide-react";
import type { ImpersonationMeta } from "@/lib/admin/impersonation-shared";

/**
 * Shown on every customer page while an admin is viewing the account.
 * Exit is a plain form POST, so it works even if client JS fails.
 */
export default function ImpersonationBanner({ meta }: { meta: ImpersonationMeta }) {
  const until = new Date(meta.exp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return (
    <div role="status" className="sticky top-0 z-[70] flex flex-wrap items-center justify-between gap-3 bg-[#5b21b6] px-4 py-2.5 text-white shadow-md">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          YOU ARE VIEWING THIS ACCOUNT AS {meta.label.toUpperCase()}
          <span className="ml-2 font-normal text-violet-200">Read-only · ends {until} UTC · audited</span>
        </span>
      </p>
      <form action="/api/super-admin/impersonation/end" method="post">
        <button className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#5b21b6] hover:bg-violet-50">
          Exit impersonation
        </button>
      </form>
    </div>
  );
}
