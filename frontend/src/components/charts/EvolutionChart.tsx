import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

import type { ForecastVersion } from "../../types/api";
import {
  formatLeadHours,
  formatMw,
  formatNumber,
  formatUtcDateTime,
} from "../../utils/format";
import { ChartTooltipFrame, ChartTooltipRow } from "./ChartTooltip";
import {
  axisLabel,
  axisTick,
  chartColors,
  legendStyle,
  lineCursor,
} from "./chartTheme";

function EvolutionTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as ForecastVersion;
  return (
    <ChartTooltipFrame title={formatUtcDateTime(row.publish_time)}>
      <ChartTooltipRow label="Forecast" value={formatMw(row.forecast_mw)} color={chartColors.selected} />
      <ChartTooltipRow label="Lead time" value={formatLeadHours(row.forecast_lead_hours)} />
      <ChartTooltipRow
        label="At cutoff"
        value={row.eligible_at_cutoff ? "Eligible" : "After cutoff"}
      />
      {row.is_selected ? (
        <p className="pt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-lavender">
          Selected forecast
        </p>
      ) : null}
    </ChartTooltipFrame>
  );
}

export function EvolutionChart({
  versions,
  actualMw,
  decisionLeadHours,
}: {
  versions: ForecastVersion[];
  actualMw: number | null;
  decisionLeadHours: number | null;
}) {
  const data = [...versions]
    .sort((a, b) => a.forecast_lead_hours - b.forecast_lead_hours)
    .map((version) => ({
      ...version,
      forecast: version.forecast_mw,
      eligibleMw: version.eligible_at_cutoff ? version.forecast_mw : null,
      ineligibleMw: version.eligible_at_cutoff ? null : version.forecast_mw,
      selectedMw: version.is_selected ? version.forecast_mw : null,
    }));

  return (
    <div className="h-[280px] w-full sm:h-[340px]" aria-label="Forecast evolution by publication lead time">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 20, left: 8, bottom: 24 }}
          accessibilityLayer
        >
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="forecast_lead_hours"
            type="number"
            reversed
            domain={["dataMin - 1", "dataMax + 1"]}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: chartColors.axis }}
            tickFormatter={(value: number) => `${formatNumber(value)}h`}
            label={{
              value: "Lead time before delivery (hours)",
              position: "insideBottom",
              offset: -14,
              ...axisLabel,
            }}
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
          <Tooltip content={<EvolutionTooltip />} cursor={lineCursor} />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={legendStyle}
          />
          {actualMw !== null ? (
            <ReferenceLine
              y={actualMw}
              stroke={chartColors.actual}
              strokeDasharray="5 4"
              label={{
                value: "Actual",
                position: "insideTopRight",
                fill: chartColors.actual,
                fontSize: 10,
              }}
            />
          ) : null}
          {decisionLeadHours !== null ? (
            <ReferenceLine
              x={decisionLeadHours}
              stroke={chartColors.cutoff}
              strokeDasharray="4 4"
              label={{
                value: "Decision cutoff",
                position: "insideTopLeft",
                fill: chartColors.cutoff,
                fontSize: 10,
              }}
            />
          ) : null}
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast path"
            stroke={chartColors.path}
            strokeWidth={1.3}
            dot={false}
            isAnimationActive={false}
          />
          <Scatter
            dataKey="eligibleMw"
            name="Eligible at cutoff"
            fill={chartColors.eligible}
            isAnimationActive={false}
          />
          <Scatter
            dataKey="ineligibleMw"
            name="Published after cutoff"
            fill={chartColors.ineligible}
            isAnimationActive={false}
          />
          <Scatter
            dataKey="selectedMw"
            name="Selected forecast"
            fill={chartColors.selected}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
