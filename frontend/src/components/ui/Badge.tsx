import type { ReactNode } from "react";

import { cx } from "../../utils/format";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const tones: Record<BadgeTone, string> = {
  neutral: "border-graphite bg-white/[0.02] text-ash",
  success: "border-mint/35 bg-mint/[0.05] text-mint",
  warning: "border-steel bg-white/[0.03] text-bone",
  danger: "border-danger/30 bg-danger/[0.04] text-danger",
  info: "border-lavender/35 bg-lavender/[0.05] text-[#c9bcef]",
  accent: "border-lavender/45 bg-lavender/[0.08] text-[#d8cef4]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
