import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

import type { GroupMetrics } from "../../types/api";
import { formatNumber, formatPct } from "../../utils/format";
import { ChartTooltipFrame, ChartTooltipRow } from "./ChartTooltip";
import { axisLabel, axisTick, chartColors } from "./chartTheme";

function HorizonTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltipFrame title={`${String(label)} lead time`}>
      <ChartTooltipRow
        label="WAPE"
        value={formatPct(payload[0].value as number)}
        color={payload[0].color}
      />
    </ChartTooltipFrame>
  );
}

export function HorizonChart({ groups }: { groups: GroupMetrics[] }) {
  const data = groups
    .filter((group) => group.label !== "Unknown")
    .map((group) => ({ label: group.label, wape: group.wape_pct }));

  return (
    <div className="h-[250px] w-full" aria-label="WAPE by forecast lead time bucket">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
          accessibilityLayer
        >
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: chartColors.axis }}
          />
          <YAxis
            width={60}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => `${formatNumber(value)}%`}
            label={{
              value: "%",
              angle: -90,
              position: "left",
              offset: 2,
              ...axisLabel,
            }}
          />
          <Tooltip content={<HorizonTooltip />} cursor={{ fill: "rgba(255,255,255,0.035)" }} />
          <Bar dataKey="wape" name="WAPE" radius={[3, 3, 0, 0]} maxBarSize={40}>
            {data.map((entry) => (
              <Cell
                key={entry.label}
                fill={
                  entry.label === "Post-delivery (<0h)"
                    ? chartColors.selected
                    : chartColors.eligible
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
