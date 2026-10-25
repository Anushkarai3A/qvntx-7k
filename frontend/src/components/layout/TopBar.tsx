import { Database, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { cx } from "../../utils/format";
import { SelectionControls } from "./SelectionControls";

const navigation = [
  { to: "/", label: "Home", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/accuracy", label: "Forecast accuracy" },
  { to: "/evolution", label: "Forecast evolution" },
  { to: "/explorer", label: "Data explorer" },
];

export function TopBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const showSelectionControls = location.pathname !== "/";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-graphite bg-void/95 backdrop-blur-md supports-[backdrop-filter]:bg-void/90">
        <div className="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <NavLink
              to="/"
              end
              className="group flex min-w-0 flex-col"
              aria-label="WindSight UK home"
            >
              <span className="truncate font-sans text-sm font-semibold tracking-tight text-ghost transition-colors group-hover:text-bone">
                WindSight UK
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-steel">
                WIND GENERATION OBSERVATORY
              </span>
            </NavLink>

            <nav
              className="ml-6 hidden items-center gap-1 lg:flex"
              aria-label="Primary navigation"
            >
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      "relative rounded-control px-3 py-2 text-[13px] transition-colors",
                      isActive
                        ? "bg-white/[0.06] text-ghost"
                        : "text-ash hover:bg-white/[0.04] hover:text-ghost",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {item.label}
                      {isActive ? (
                        <span
                          className="absolute inset-x-3 -bottom-px h-px bg-lavender"
                          aria-hidden="true"
                        />
                      ) : null}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2.5">
              <span className="hidden items-center gap-2 text-[11px] text-steel md:flex">
                <Database className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                Elexon BMRS
              </span>
              <span className="hidden rounded-full border border-graphite px-3 py-1 text-[11px] text-ash sm:inline-flex">
                Jan 2026 · UTC
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-graphite text-ash transition-colors hover:border-steel hover:text-ghost lg:hidden"
                aria-expanded={menuOpen}
                aria-controls="mobile-navigation"
                aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              >
                {menuOpen ? (
                  <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Menu className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {menuOpen ? (
            <nav
              id="mobile-navigation"
              className="grid grid-cols-2 gap-1.5 border-t border-graphite py-3 lg:hidden"
              aria-label="Mobile navigation"
            >
              {navigation.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      "rounded-control border px-3 py-2.5 text-[13px] transition-colors",
                      isActive
                        ? "border-graphite bg-white/[0.06] font-medium text-ghost"
                        : "border-transparent text-ash hover:border-graphite hover:text-ghost",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          ) : null}
        </div>
      </header>

      {showSelectionControls ? (
        <div className="border-b border-graphite bg-void">
          <div className="mx-auto max-w-page px-4 py-3 sm:px-6 lg:px-8">
            <SelectionControls />
          </div>
        </div>
      ) : null}
    </>
  );
}
