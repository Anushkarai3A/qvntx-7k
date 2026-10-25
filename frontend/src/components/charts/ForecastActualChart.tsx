import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

import type { SeriesPoint } from "../../types/api";
import { formatMw, formatNumber, formatUtcDateTime, formatUtcDateTimeShort } from "../../utils/format";
import { ChartTooltipFrame, ChartTooltipRow } from "./ChartTooltip";
import {
  axisLabel,
  axisTick,
  chartColors,
  legendStyle,
  lineCursor,
} from "./chartTheme";

function TimeTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const timestamp = typeof label === "number" ? new Date(label).toISOString() : null;
  return (
    <ChartTooltipFrame title={formatUtcDateTime(timestamp)}>
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

export function ForecastActualChart({ series }: { series: SeriesPoint[] }) {
  const data = series.map((point) => ({
    time: new Date(point.delivery_start).getTime(),
    actual: point.actual_mw,
    forecast: point.forecast_mw,
  }));

  return (
    <div className="h-[280px] w-full sm:h-[340px]" aria-label="Forecast and actual wind generation chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 16, left: 8, bottom: 4 }}
          accessibilityLayer
        >
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            minTickGap={48}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: chartColors.axis }}
            tickFormatter={(value: number) =>
              formatUtcDateTimeShort(new Date(value).toISOString())
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
          <Tooltip content={<TimeTooltip />} cursor={lineCursor} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="plainline"
            wrapperStyle={legendStyle}
          />
          <Line
            type="monotone"
            dataKey="actual"
            name="Actual generation"
            stroke={chartColors.actual}
            strokeWidth={1.8}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="Selected forecast"
            stroke={chartColors.forecast}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
