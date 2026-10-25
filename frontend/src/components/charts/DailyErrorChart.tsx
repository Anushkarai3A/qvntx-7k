import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

import type { GroupMetrics } from "../../types/api";
import { formatMw, formatNumber } from "../../utils/format";
import { ChartTooltipFrame, ChartTooltipRow } from "./ChartTooltip";
import {
  axisLabel,
  axisTick,
  chartColors,
  legendStyle,
} from "./chartTheme";

function DailyTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipFrame
      title={new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(`${String(label)}T00:00:00Z`))}
    >
      {payload.map((entry) => (
        <ChartTooltipRow
          key={String(entry.name)}
          label={String(entry.name)}
          value={formatMw(entry.value as number)}
          color={entry.color}
        />
      ))}
    </ChartTooltipFrame>
  );
}

export function DailyErrorChart({ groups }: { groups: GroupMetrics[] }) {
  const data = groups.map((group) => ({
    date: group.label,
    bias: group.mean_error_mw,
    mae: group.mae_mw,
  }));

  return (
    <div className="h-[260px] w-full" aria-label="Daily forecast bias and MAE chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
          accessibilityLayer
        >
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="date"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: chartColors.axis }}
            minTickGap={18}
            tickFormatter={(value: string) =>
              new Intl.DateTimeFormat("en-GB", {
                timeZone: "UTC",
                day: "2-digit",
                month: "short",
              }).format(new Date(`${value}T00:00:00Z`))
            }
          />
          <YAxis
            width={66}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatNumber(value)}
            label={{
              value: "MW",
              angle: -90,
              position: "left",
              offset: 2,
              ...axisLabel,
            }}
          />
          <Tooltip content={<DailyTooltip />} cursor={{ fill: "rgba(255,255,255,0.035)" }} />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={legendStyle}
          />
          <ReferenceLine y={0} stroke={chartColors.axis} />
          <Bar dataKey="bias" name="Mean error / bias" radius={[2, 2, 0, 0]} maxBarSize={18}>
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={(entry.bias ?? 0) >= 0 ? chartColors.positive : chartColors.negative}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="mae"
            name="MAE"
            stroke={chartColors.mae}
            strokeWidth={1.7}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
