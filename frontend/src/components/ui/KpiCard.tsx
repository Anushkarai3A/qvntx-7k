import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "./Card";
import { cx } from "../../utils/format";

type KpiTone = "teal" | "blue" | "amber" | "rose" | "slate";

const toneStyles: Record<KpiTone, string> = {
  teal: "border-mint/25 text-mint",
  blue: "border-lavender/30 text-lavender",
  amber: "border-graphite text-bone",
  rose: "border-graphite text-bone",
  slate: "border-graphite text-ash",
};

export function KpiCard({
  label,
  value,
  unit,
  subtitle,
  icon: Icon,
  tone = "teal",
  footer,
  unavailable = false,
  valueSize = "default",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  subtitle?: ReactNode;
  icon: LucideIcon;
  tone?: KpiTone;
  footer?: ReactNode;
  unavailable?: boolean;
  valueSize?: "default" | "compact";
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-steel">
          {label}
        </p>
        <span
          className={cx(
            "grid h-8 w-8 shrink-0 place-items-center rounded-control border bg-void/40",
            toneStyles[tone],
          )}
        >
          <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
        </span>
      </div>
      <div className="mt-5 flex items-baseline gap-1.5">
        <p
          className={cx(
            "font-medium leading-none tracking-[-0.03em]",
            valueSize === "compact" ? "text-xl" : "text-[2.125rem]",
            unavailable ? "text-steel" : "text-ghost",
          )}
        >
          {value}
        </p>
        {unit ? (
          <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-steel">
            {unit}
          </span>
        ) : null}
      </div>
      {subtitle ? (
        <div className="mt-3 min-h-[20px] text-xs leading-5 text-steel">{subtitle}</div>
      ) : null}
      {footer ? <div className="mt-3 border-t border-graphite pt-3">{footer}</div> : null}
    </Card>
  );
}
