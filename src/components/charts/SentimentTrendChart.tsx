"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DataPoint {
  week: string;
  score: number;
}

interface SentimentTrendChartProps {
  data: DataPoint[];
  color?: string;
}

function scoreToColor(score: number): string {
  if (score >= 0.2) return "#10b981"; // emerald
  if (score >= -0.1) return "#f59e0b"; // amber
  return "#ef4444"; // red
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const score: number = payload[0].value;
  const color = scoreToColor(score);
  const label2 =
    score >= 0.2 ? "Positive" : score >= -0.1 ? "Neutral" : "Negative";
  return (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="text-zinc-500 mb-1">{label}</p>
      <p className="font-semibold" style={{ color }}>
        {score > 0 ? "+" : ""}
        {score.toFixed(2)} — {label2}
      </p>
    </div>
  );
}

export default function SentimentTrendChart({
  data,
  color,
}: SentimentTrendChartProps) {
  const lastScore = data[data.length - 1]?.score ?? 0;
  const lineColor = color ?? scoreToColor(lastScore);

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[-1, 1]}
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          tickCount={3}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <ReferenceLine y={0} stroke="#e4e4e7" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
