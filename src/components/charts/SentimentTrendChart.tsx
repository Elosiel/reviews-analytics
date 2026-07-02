"use client";

import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { POS, NEG, fmtScore } from "@/lib/design";

interface DataPoint {
  week: string;
  score: number;
}

interface SentimentTrendChartProps {
  data: DataPoint[];
  /** Unique id per chart instance so gradient defs don't collide */
  id: string;
  height?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const score: number = payload[0].value;
  const mood =
    score >= 0.2 ? "Positive" : score <= -0.2 ? "Negative" : "Mixed";
  return (
    <div className="bg-paper border border-line rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-ink-faint mb-0.5">Week of {label}</p>
      <p className="font-semibold text-ink tabular-nums">
        {fmtScore(score)}{" "}
        <span className="font-normal text-ink-soft">· {mood}</span>
      </p>
    </div>
  );
}

/**
 * Weekly sentiment trend for one category. Single series — the panel title
 * names it (no legend), and the line color encodes polarity of the current
 * value, always paired with the visible signed delta next to the title.
 */
export default function SentimentTrendChart({
  data,
  id,
  height = 120,
}: SentimentTrendChartProps) {
  const lastScore = data[data.length - 1]?.score ?? 0;
  const lineColor = lastScore >= 0 ? POS : NEG;
  const gradId = `trend-${id}`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#f1ecdf" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: "#97907f" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[-1, 1]}
          ticks={[-1, 0, 1]}
          tick={{ fontSize: 10, fill: "#97907f" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
        />
        <ReferenceLine y={0} stroke="#c9c2ae" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#c9c2ae" }} />
        <Area
          type="monotone"
          dataKey="score"
          stroke={lineColor}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          dot={false}
          activeDot={{ r: 4, fill: lineColor, strokeWidth: 2, stroke: "#fffdf8" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
