import Link from "next/link";
import LogoMark from "@/components/shared/LogoMark";
import PreviewReportView from "@/components/preview/PreviewReportView";

export const metadata = {
  title: "Your public-reviews preview report · Reviews Analytics",
  description: "A one-page snapshot of what your public Google reviews say — themes, top fixes and risks.",
  robots: { index: false },
};

export default async function PreviewReportPage({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  return (
    <div className="min-h-screen bg-cream print:bg-white">
      <header className="border-b border-line bg-paper/80 backdrop-blur-sm print:hidden">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark className="w-6 h-6" />
            <span className="font-heading font-semibold text-ink text-sm tracking-tight">Reviews Analytics</span>
          </Link>
          <Link href="/preview" className="text-sm font-medium text-forest hover:text-forest-soft">
            ← Try another restaurant
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <PreviewReportView placeId={placeId} />
      </main>
    </div>
  );
}
