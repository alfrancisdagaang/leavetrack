"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccountMenu } from "@/components/ui/account-menu";
import { NotificationBell } from "@/components/ui/notification-bell";
import type { UserRole } from "@/lib/db/types";
import { initialsOf } from "@/components/ui/initials";
import { currentNavItem, type NavItem } from "@/components/ui/nav";
import { NAV_ICON } from "@/components/ui/nav-icons";

interface AppFrameProps {
  role: UserRole;
  /** IANA zone (APP_TIMEZONE): the bell shows times by this calendar. */
  timeZone: string;
  userName: string;
  email: string;
  roleLabel: string;
  workspace: string;
  items: NavItem[];
  signOutAction: () => Promise<void>;
  children: ReactNode;
}

const ROW =
  "group relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm text-nav-text transition-colors";

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className="flex min-h-11 items-center gap-2 rounded-lg">
      <Image src="/icons/logo.svg" alt="" width={36} height={36} unoptimized />
      <span className={collapsed ? "sr-only" : "text-[21px] font-bold text-white"}>LeaveTrack</span>
    </Link>
  );
}

interface NavListProps {
  items: NavItem[];
  pathname: string;
  collapsed?: boolean;
}

/** The role's navigation. The current page is highlighted and marked aria-current. */
function NavList({ items, pathname, collapsed = false }: NavListProps) {
  const currentKey = currentNavItem(items, pathname)?.key;
  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const icon = NAV_ICON[item.key];
          const current = item.key === currentKey;
          const content = (
            <>
              {icon ? <Image src={icon} alt="" width={23} height={23} unoptimized /> : null}
              <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
              {item.available ? null : <span className="text-xs">(soon)</span>}
              {collapsed ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white group-hover:block group-focus-visible:block"
                >
                  {item.label}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={item.key}>
              {item.available ? (
                <Link
                  href={item.href}
                  prefetch={false}
                  aria-current={current ? "page" : undefined}
                  className={`${ROW} ${
                    current ? "bg-nav-item-active font-semibold" : "font-medium hover:bg-white/10"
                  }`}
                >
                  {content}
                </Link>
              ) : (
                <span aria-disabled="true" className={`${ROW} font-medium opacity-60`}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Signed-in chrome: a left sidebar (collapsible from `lg`, a drawer below it) and a slim top bar
 * with the account menu. The page itself is the server-rendered `children`. Which items show is
 * decided by navItemsFor(role); access is still enforced by each page and route.
 */
export function AppFrame({
  role,
  timeZone,
  userName,
  email,
  roleLabel,
  workspace,
  items,
  signOutAction,
  children,
}: AppFrameProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  // Remember which page the drawer was opened on, so navigating closes it without an effect.
  const [drawerOn, setDrawerOn] = useState<string | null>(null);
  const drawerOpen = drawerOn === pathname;
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    const menuButton = menuButtonRef.current;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOn(null);
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      // Keep Tab inside the open drawer.
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>("a[href], button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [drawerOpen]);

  const title = currentNavItem(items, pathname)?.label ?? "LeaveTrack";

  return (
    <div className="min-h-dvh lg:flex">
      <aside
        id="sidebar"
        data-on-dark
        className={`hidden shrink-0 flex-col gap-3 bg-nav px-3 py-4 transition-[width] motion-reduce:transition-none lg:sticky lg:top-0 lg:flex lg:h-dvh ${
          collapsed ? "w-[72px]" : "w-[232px]"
        }`}
      >
        <Brand collapsed={collapsed} />
        {collapsed ? null : (
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-nav-muted">
            {workspace}
          </p>
        )}
        <NavList items={items} pathname={pathname} collapsed={collapsed} />
        <div className="flex-1" />
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="sidebar"
          onClick={() => setCollapsed(!collapsed)}
          className="group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-nav-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          <Image
            src={collapsed ? "/icons/panel-left-open.svg" : "/icons/panel-left-close.svg"}
            alt=""
            width={20}
            height={20}
            unoptimized
          />
          <span className={collapsed ? "sr-only" : undefined}>
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </span>
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-line bg-white px-4 sm:px-8">
          <button
            ref={menuButtonRef}
            type="button"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
            aria-label="Open navigation"
            onClick={() => setDrawerOn(pathname)}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink hover:bg-brand-50 lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <p className="min-w-0 flex-1 truncate text-lg font-semibold text-ink">{title}</p>
          <NotificationBell role={role} timeZone={timeZone} />
          <AccountMenu
            name={userName}
            roleLabel={roleLabel}
            email={email}
            signOutAction={signOutAction}
          />
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1352px] flex-1 p-4 sm:p-8">
          {children}
        </main>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-nav/30"
            onClick={() => setDrawerOn(null)}
          />
          <div
            ref={drawerRef}
            id="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            data-on-dark
            className="absolute inset-y-0 left-0 flex w-[292px] max-w-[calc(100vw-3rem)] flex-col gap-5 overflow-y-auto bg-nav px-4 py-5"
          >
            <div className="flex items-center justify-between">
              <Brand />
              <button
                ref={closeRef}
                type="button"
                aria-label="Close navigation"
                onClick={() => setDrawerOn(null)}
                className="flex size-11 items-center justify-center rounded-lg hover:bg-white/10"
              >
                <Image src="/icons/close.svg" alt="" width={20} height={20} unoptimized />
              </button>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-nav-muted">
              {workspace}
            </p>
            <NavList items={items} pathname={pathname} />
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-500"
              >
                {initialsOf(userName)}
              </span>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-semibold text-white">{userName}</p>
                <p className="mt-1 text-xs text-nav-muted">{roleLabel}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
