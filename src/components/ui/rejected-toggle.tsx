"use client";

import { useRouter } from "next/navigation";

/**
 * "Show rejected and cancelled": a real switch. The state lives in the URL (`href` is the page
 * as it would look after flipping it), so the server re-reads the data under the same scope.
 */
export function RejectedToggle({ checked, href }: { checked: boolean; href: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => router.replace(href, { scroll: false })}
      className="flex min-h-11 items-center gap-2 rounded-lg text-[11px] text-ink"
    >
      <span
        aria-hidden="true"
        className={`flex h-4 w-7 shrink-0 items-center rounded-full px-px transition-colors ${
          checked ? "justify-end bg-brand-500" : "justify-start bg-ink-muted"
        }`}
      >
        <span className="size-3.5 rounded-full bg-white" />
      </span>
      Show rejected and cancelled
    </button>
  );
}
