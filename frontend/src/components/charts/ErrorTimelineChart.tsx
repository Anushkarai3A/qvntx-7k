import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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

function ErrorTooltip({ active, payload, label }: TooltipProps<number, string>) {
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

export function ErrorTimelineChart({ series }: { series: SeriesPoint[] }) {
  const data = series.map((point) => ({
    time: new Date(point.delivery_start).getTime(),
    signed: point.signed_error_mw,
    absolute: point.abs_error_mw,
  }));

  return (
    <div className="h-[260px] w-full" aria-label="Signed and absolute forecast error chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
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
          <Tooltip content={<ErrorTooltip />} cursor={lineCursor} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="plainline"
            wrapperStyle={legendStyle}
          />
          <ReferenceLine y={0} stroke={chartColors.axis} strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="signed"
            name="Signed error (F − A)"
            stroke={chartColors.signed}
            strokeWidth={1.6}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="absolute"
            name="Absolute error"
            stroke={chartColors.absolute}
            strokeWidth={1.6}
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
