import type { ReactNode } from "react";

export function ChartTooltipFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-[180px] rounded-control border border-graphite bg-carbon p-3 text-xs">
      <p className="font-medium text-ghost">{title}</p>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

export function ChartTooltipRow({
  label,
  value,
  color,
}: {
  label: string;
  value: ReactNode;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="inline-flex items-center gap-1.5 text-ash">
        {color ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        ) : null}
        {label}
      </span>
      <span className="font-medium tabular-nums text-bone">{value}</span>
    </div>
  );
}
