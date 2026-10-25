import type { HTMLAttributes, ReactNode } from "react";

import { cx } from "../../utils/format";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx("rounded-card border border-graphite bg-carbon", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-graphite px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-display text-[1.35rem] font-normal leading-tight text-ghost">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-xs leading-5 text-steel">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
