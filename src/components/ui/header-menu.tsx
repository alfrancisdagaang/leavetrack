"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Below `lg` the nav and account controls sit behind a Menu button (a disclosure, not a dialog);
 * from `lg` up the panel dissolves (`lg:contents`) so they sit inline in the header bar.
 * The menu closes on navigation and on Escape. The panel's children are rendered on the server.
 */
export function HeaderMenu({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenOn(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="header-menu"
        onClick={() => setOpenOn(open ? null : pathname)}
        className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg border border-nav-border px-3.5 text-[15px] font-medium text-nav-text transition-colors hover:bg-white/10 lg:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d={open ? "M5 5l10 10M15 5L5 15" : "M3 5h14M3 10h14M3 15h14"}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        Menu
      </button>
      <div
        id="header-menu"
        className={`${open ? "flex" : "hidden"} w-full flex-col gap-4 border-t border-white/10 pt-3 lg:contents`}
      >
        {children}
      </div>
    </>
  );
}
