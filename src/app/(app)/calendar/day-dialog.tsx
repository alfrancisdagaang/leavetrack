"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

/**
 * EPIC-7. The open day as a popup over the month: a centred card from `sm`, a sheet from the bottom
 * of the screen below it. A native modal `<dialog>`, so the browser traps focus inside, makes the page
 * behind it inert and closes it on Escape. The day is still in the address: Escape, a click on the
 * backdrop and the Close link all go back to the month with the same filters. It is rendered open on
 * the server, so the day also shows without JavaScript (without the backdrop and focus trap).
 */
export function DayDialog({ closeHref, children }: { closeHref: string; children: ReactNode }) {
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
      aria-labelledby="cal-day-heading"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event: MouseEvent<HTMLDialogElement>) => {
        // A click on the dialog itself (not its content) is a click on the backdrop.
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-x-0 bottom-0 top-auto z-50 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain rounded-t-2xl border border-brand-50 bg-white p-0 shadow-tile backdrop:bg-black/40 sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-2xl"
    >
      <div className="p-4 sm:p-6">{children}</div>
    </dialog>
  );
}
