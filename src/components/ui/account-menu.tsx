"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { initialsOf } from "@/components/ui/initials";

interface AccountMenuProps {
  name: string;
  roleLabel: string;
  email: string;
  signOutAction: () => Promise<void>;
}

/**
 * The avatar in the top bar. A disclosure (not an ARIA menu): the panel shows who is signed in
 * (name, role, email) and a Sign out form. Closes on Escape (focus returns to the button), on a
 * click outside, and on navigation.
 */
export function AccountMenu({ name, roleLabel, email, signOutAction }: AccountMenuProps) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenOn(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const initials = initialsOf(name);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="account-panel"
        aria-label={`Account menu for ${name}`}
        onClick={() => setOpenOn(open ? null : pathname)}
        className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-left"
      >
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-500"
        >
          {initials}
        </span>
        <span className="hidden leading-tight sm:block">
          <span className="block text-[13px] font-semibold text-ink">{name}</span>
          <span className="mt-0.5 block text-[11px] text-ink-muted">{roleLabel}</span>
        </span>
        <Image src="/icons/chevron-down.svg" alt="" width={16} height={16} unoptimized />
      </button>
      {open ? (
        <div
          id="account-panel"
          className="absolute right-0 top-full z-30 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-tile border border-line bg-white p-4 shadow-tile"
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-500"
            >
              {initials}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
              <p className="mt-1 text-xs text-ink-muted">{roleLabel}</p>
            </div>
          </div>
          <p className="break-all text-xs text-ink-muted">{email}</p>
          <hr className="border-line" />
          <Link
            href="/profile"
            prefetch={false}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-lg text-[13px] font-semibold text-ink hover:bg-brand-50"
          >
            <Image src="/icons/user-dark.svg" alt="" width={20} height={20} unoptimized />
            Profile
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-2.5 rounded-lg text-[13px] font-semibold text-ink hover:bg-brand-50"
            >
              <Image src="/icons/log-out-dark.svg" alt="" width={20} height={20} unoptimized />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
