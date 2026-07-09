import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/data/dashboard";
import {
  MOCK_RANKED_ISSUES,
  MOCK_LOVES,
  MOCK_LOCATIONS,
  MOCK_MATRIX,
  MOCK_NEEDS_ATTENTION,
  MOCK_RECOVERY,
  MOCK_WEEK,
  mockTrendData,
  mockGroupTrend,
} from "@/lib/mock-data";
import DashboardOverviewClient from "@/components/dashboard/DashboardOverviewClient";
import { CATEGORIES } from "@/lib/design";
import type { SentimentCategory } from "@/types";
import type { TrendPoint } from "@/lib/data/dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const data = await getDashboardData(supabase);

  if (!data.hasRealData) {
    const trendsByCategory = Object.fromEntries(
      CATEGORIES.map((c) => [c, mockTrendData(c)])
    ) as Record<SentimentCategory, TrendPoint[]>;

    return (
      <DashboardOverviewClient
        locations={MOCK_LOCATIONS}
        matrix={MOCK_MATRIX}
        rankedIssues={MOCK_RANKED_ISSUES}
        loves={MOCK_LOVES}
        needsAttention={MOCK_NEEDS_ATTENTION}
        recovery={MOCK_RECOVERY}
        week={{ new_reviews: MOCK_WEEK.new_reviews, best: MOCK_WEEK.best, worst: MOCK_WEEK.worst }}
        groupTrend={mockGroupTrend()}
        trendsByCategory={trendsByCategory}
      />
    );
  }

  return (
    <DashboardOverviewClient
      locations={data.locations}
      matrix={data.matrix}
      rankedIssues={data.rankedIssues}
      loves={data.loves}
      needsAttention={data.needsAttention}
      recovery={data.recovery}
      week={data.week}
      groupTrend={data.groupTrend}
      trendsByCategory={data.trendsByCategory}
    />
  );
}
