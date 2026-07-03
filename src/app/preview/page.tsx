import Link from "next/link";
import LogoMark from "@/components/shared/LogoMark";
import RestaurantTeaser from "@/components/preview/RestaurantTeaser";

export const metadata = {
  title: "See what your reviews are hiding · Reviews Analytics",
  description:
    "Google shows the public a handful of your reviews. Connect your Business Profile and read every one — ranked by what's costing you stars.",
};

/**
 * Public teaser page (no auth). A shareable link for prospects: search a
 * sample restaurant, see the public sliver Google exposes, and hit the
 * "connect to unlock the full analysis" hook that leads to sign-up.
 */
export default function PreviewPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <header className="border-b border-line bg-paper/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="w-6 h-6" />
            <span className="font-heading font-semibold text-ink text-sm tracking-tight">
              Reviews Analytics
            </span>
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-forest hover:text-forest-soft transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 sm:py-16 space-y-10">
        {/* Hero */}
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-block text-[11px] uppercase tracking-[0.16em] text-forest font-semibold bg-[#eef6f1] rounded-full px-3 py-1">
            Live preview
          </span>
          <h1 className="font-heading text-[32px] sm:text-[40px] leading-[1.1] font-semibold text-ink mt-4">
            Your reviews are trying to tell you something.
          </h1>
          <p className="text-[15px] sm:text-base text-ink-soft mt-4 leading-relaxed">
            Google shows the public a handful of your reviews and one number.
            Connect your Business Profile and we read every review across every
            location — then hand you a ranked list of what&apos;s costing you
            stars, and where.
          </p>
        </div>

        {/* The interactive teaser */}
        <RestaurantTeaser />

        {/* Reassurance footer */}
        <div className="max-w-2xl mx-auto text-center pt-6 border-t border-line-soft">
          <p className="text-sm text-ink-soft">
            Built for multi-location restaurant groups.
          </p>
          <Link
            href="/login"
            className="inline-block mt-4 text-sm font-semibold text-forest hover:text-forest-soft transition-colors"
          >
            Start reading your reviews →
          </Link>
        </div>
      </main>
    </div>
  );
}
