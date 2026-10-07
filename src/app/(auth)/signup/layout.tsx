import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Start your free trial — Reviews Analytics",
  description:
    "Turn your Google reviews into clear, actionable restaurant intelligence. See what guests love, what frustrates them, and which location needs you first.",
  openGraph: {
    title: "Start your 30-day free trial — Reviews Analytics",
    description:
      "Your customers are already telling you what to improve. Reviews Analytics turns your Google reviews into a ranked list of what to fix, for one location or fifty.",
  },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
