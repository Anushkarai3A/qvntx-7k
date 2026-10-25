import { Info } from "lucide-react";
import type { ReactNode } from "react";

export function Callout({
  title,
  children,
  tone = "info",
}: {
  title?: string;
  children: ReactNode;
  tone?: "info" | "warning";
}) {
  const iconStyles = tone === "warning" ? "text-bone" : "text-lavender";
  return (
    <div className="rounded-card border border-graphite bg-carbon p-4">
      <div className="flex gap-3">
        <Info className={`mt-0.5 h-4 w-4 shrink-0 ${iconStyles}`} strokeWidth={1.5} aria-hidden="true" />
        <div className="min-w-0 text-xs leading-5 text-ash">
          {title ? <p className="font-medium text-ghost">{title}</p> : null}
          <div className={title ? "mt-1" : ""}>{children}</div>
        </div>
      </div>
    </div>
  );
}
