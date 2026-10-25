import { AlertTriangle, CheckCircle2, Database, RefreshCw } from "lucide-react";

import { Badge } from "./Badge";
import type { DataStatus } from "../../types/api";
import { formatUtcDateTime } from "../../utils/format";

export function DataStatusBar({ status }: { status: DataStatus }) {
  const hasWarnings = status.warnings.length > 0;
  return (
    <div className="rounded-card border border-graphite bg-carbon">
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-steel">
          <span className="inline-flex items-center gap-1.5 font-medium text-bone">
            <Database className="h-3.5 w-3.5 text-lavender" strokeWidth={1.5} aria-hidden="true" />
            Elexon BMRS
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-steel" strokeWidth={1.5} aria-hidden="true" />
            Retrieved {formatUtcDateTime(status.retrieved_at)}
          </span>
          <span>{status.actual_records.toLocaleString("en-GB")} actual intervals</span>
          <span>{status.forecast_records.toLocaleString("en-GB")} forecast versions</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.cache_state === "stale" ? "warning" : "success"}>
            {status.cache_state === "stale" ? (
              <AlertTriangle className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
            )}
            {status.cache_state === "stale" ? "Stale cache" : "Data current"}
          </Badge>
          <Badge tone="info">
            {status.retrieval_source === "upstream" ? "Live retrieval" : "Local cache"}
          </Badge>
        </div>
      </div>
      {hasWarnings ? (
        <details className="group border-t border-graphite px-4 py-3 text-xs text-ash">
          <summary className="cursor-pointer select-none font-medium text-bone marker:text-lavender">
            {status.warnings.length} data {status.warnings.length === 1 ? "notice" : "notices"}
          </summary>
          <ul className="mt-2 space-y-1.5 pl-4">
            {status.warnings.map((warning) => (
              <li key={warning} className="list-disc leading-5">
                {warning}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
