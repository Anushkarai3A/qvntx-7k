import { AlertTriangle, RefreshCw, SearchX } from "lucide-react";

import { Card } from "./Card";

export function LoadingState({ label = "Loading analytics" }: { label?: string }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="animate-pulse p-5">
            <div className="h-2.5 w-24 rounded bg-white/[0.07]" />
            <div className="mt-5 h-8 w-32 rounded bg-white/[0.09]" />
            <div className="mt-4 h-2.5 w-40 rounded bg-white/[0.05]" />
          </Card>
        ))}
      </div>
      <Card className="animate-pulse p-6">
        <div className="h-3 w-44 rounded bg-white/[0.07]" />
        <div className="mt-6 h-64 rounded-control bg-white/[0.035]" />
      </Card>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  hint,
}: {
  message: string;
  onRetry?: () => void;
  hint?: string;
}) {
  return (
    <Card className="p-6" role="alert">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control border border-danger/30 bg-danger/[0.04] text-danger">
          <AlertTriangle className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[1.5rem] leading-tight text-ghost">
            Unable to load data
          </h2>
          <p className="mt-2 text-sm leading-6 text-ash">{message}</p>
          {hint ? <p className="mt-2 text-xs leading-5 text-steel">{hint}</p> : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex items-center gap-2 rounded-control bg-ghost px-4 py-2 text-xs font-semibold text-void transition-colors hover:bg-bone"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({
  title = "No records match this view",
  message = "Adjust the delivery date, forecast horizon or data availability filter.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <Card className="p-10 text-center">
      <SearchX className="mx-auto h-7 w-7 text-steel" strokeWidth={1.5} aria-hidden="true" />
      <h2 className="mt-4 font-display text-[1.6rem] leading-tight text-ghost">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-steel">{message}</p>
    </Card>
  );
}
