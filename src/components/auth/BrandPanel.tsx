import LogoMark from "@/components/shared/LogoMark";
import { cn } from "@/lib/utils";

export function BrandLockup({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8" />
      <span className={cn("text-[17px] font-semibold tracking-tight", tone === "dark" ? "text-white" : "text-zinc-900")}>
        Reviews Analytics
      </span>
    </div>
  );
}

/**
 * The dark half of /login and /signup (desktop). Logo pinned top-left,
 * footer pinned to the bottom, and the main content physically centered in
 * the space between — in a max-width block, so it never hugs the left edge.
 */
export default function BrandPanel({
  children,
  footer,
  className,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "relative hidden lg:flex flex-col overflow-hidden bg-night px-10 py-10 xl:px-14",
        className
      )}
    >
      {/* Restrained depth: one soft glow in the logo's cyan, a faint grid. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-signal/[0.07] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />

      <BrandLockup className="relative z-10 self-start" />

      <div className="relative z-10 flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[560px]">{children}</div>
      </div>

      <div className="relative z-10 text-xs leading-relaxed text-zinc-400">{footer}</div>
    </aside>
  );
}
