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
import { fmtScore } from "@/lib/design";

const LINE = "#0b7d5a";

interface DataPoint {
  week: string;
  score: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const score: number = payload[0].value;
  return (
    <div className="bg-paper border border-line rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-ink-faint mb-0.5">Week of {label}</p>
      <p className="font-semibold text-ink tabular-nums">
        {fmtScore(score)}{" "}
        <span className="font-normal text-ink-soft">group sentiment</span>
      </p>
    </div>
  );
}

/**
 * Whole-business sentiment: every review, every category, every location,
 * mention-weighted, by week. The single line the owner should watch.
 */
export default function GroupTrendChart({ data }: { data: DataPoint[] }) {
  const last = data[data.length - 1]?.score ?? 0;
  const first = data[0]?.score ?? 0;
  const change = last - first;

  return (
    <div className="rounded-2xl bg-paper border border-line p-6 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
            Whole-business sentiment
          </p>
          <p className="font-heading text-[26px] leading-tight font-semibold text-ink mt-1 tabular-nums">
            {fmtScore(last)}
            <span
              className="text-sm font-bold ml-2.5"
              style={{ color: change >= 0 ? "#0b7d5a" : "#c73527" }}
            >
              {change >= 0 ? "▲" : "▼"} {fmtScore(change)} over 90 days
            </span>
          </p>
        </div>
        <p className="text-[11px] text-ink-faint text-right leading-relaxed shrink-0">
          all locations · all categories
          <br />
          weighted by mentions
        </p>
      </div>

      <div className="mt-3 flex-1 min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 6, right: 4, bottom: 0, left: -18 }}
          >
            <defs>
              <linearGradient id="group-trend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE} stopOpacity={0.22} />
                <stop offset="100%" stopColor={LINE} stopOpacity={0.02} />
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
              domain={[-0.25, 0.75]}
              ticks={[-0.25, 0, 0.25, 0.5, 0.75]}
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
              stroke={LINE}
              strokeWidth={2.5}
              fill="url(#group-trend)"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4.5, fill: LINE, strokeWidth: 2, stroke: "#fffdf8" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
