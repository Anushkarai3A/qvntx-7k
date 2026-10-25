import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 border-b border-graphite pb-7 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-steel">
            <span className="h-1 w-1 rounded-full bg-lavender" aria-hidden="true" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-balance font-display text-[2.75rem] font-normal leading-[0.95] tracking-[-0.015em] text-ghost sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ash">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 lg:pb-1">{actions}</div> : null}
    </div>
  );
}
