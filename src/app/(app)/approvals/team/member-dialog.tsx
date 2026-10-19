"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

/**
 * The open team member as a popup over My Team: a centred card from `sm`, a sheet from the bottom of
 * the screen below it (the same behaviour as the HR calendar's day popup). A native modal `<dialog>`,
 * so the browser traps focus, makes the page behind it inert and closes it on Escape. The person is
 * in the address (`?member=<id>`): Escape, a click on the backdrop and the Close link all go back to
 * the plain My Team page. It is rendered open on the server, so it also shows without JavaScript
 * (without the backdrop and focus trap). The content labels it with `#member-dialog-heading`.
 */
export function MemberDialog({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const close = () => router.push(closeHref, { scroll: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Rendered open by the server: reopen it as a modal now that the script is running.
    if (el.open) el.close();
    el.showModal();
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
      if (el.open) el.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      open
      aria-labelledby="member-dialog-heading"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event: MouseEvent<HTMLDialogElement>) => {
        // A click on the dialog itself (not its content) is a click on the backdrop.
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-x-0 bottom-0 top-auto z-50 m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border border-brand-50 bg-grey-50 p-0 shadow-tile backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[90dvh] sm:max-w-4xl sm:rounded-2xl"
    >
      <div className="p-4 sm:p-6">{children}</div>
    </dialog>
  );
}

/** The Close control: a link, so it also works without JavaScript. */
export function CloseLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      scroll={false}
      aria-label="Close"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </Link>
  );
}
