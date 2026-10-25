import { Outlet } from "react-router-dom";

import { TopBar } from "./TopBar";

export function Layout() {
  return (
    <div className="min-h-screen bg-void">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-ghost focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-void"
      >
        Skip to content
      </a>
      <TopBar />
      <main
        id="main-content"
        className="mx-auto max-w-page px-4 pb-10 pt-9 sm:px-6 lg:px-8 lg:pt-12"
      >
        <Outlet />
        <footer className="mt-16 border-t border-graphite pt-8 text-[11px] leading-5 text-steel">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-2xl space-y-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ghost">WindSight UK</span>
                <span className="text-graphite">·</span>
                <span className="text-ash">UK wind generation forecast analysis</span>
              </div>
              <p>
                WindSight UK monitors national wind generation forecast accuracy using only
                Elexon BMRS FUELHH WIND actuals and WINDFOR forecasts. It does not calculate
                total procurement requirements, demand, prices, or other fuel generation.
              </p>
              <p>
                Metrics are computed in the Python backend. All timestamps are UTC. Missing
                values are never treated as zero.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <a href="/dashboard" className="text-ash transition-colors hover:text-ghost">
                  Dashboard
                </a>
                <a href="/accuracy" className="text-ash transition-colors hover:text-ghost">
                  Forecast accuracy
                </a>
                <a href="/evolution" className="text-ash transition-colors hover:text-ghost">
                  Forecast evolution
                </a>
                <a href="/explorer" className="text-ash transition-colors hover:text-ghost">
                  Data explorer
                </a>
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-graphite">
                January 2026 · Elexon BMRS
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
