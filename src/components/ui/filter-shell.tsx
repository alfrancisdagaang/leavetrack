"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from "react";

type FilterNav = {
  /** True while the page is fetching the new results. */
  pending: boolean;
  /** Go to an address on this page without reloading it. */
  navigate: (href: string) => void;
};

const FilterNavContext = createContext<FilterNav | null>(null);

/**
 * Applying a filter changes only the address. This navigates on the client, in a transition, so the
 * shell, the header and the filter card stay as they are while just the results are replaced (the old
 * results stay on screen, dimmed, until the new ones arrive). The address still changes, so the back
 * button and a reload keep the view. Without JavaScript the filter form is a plain GET form.
 */
export function FilterShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const navigate = useCallback(
    (href: string) => start(() => router.push(href, { scroll: false })),
    [router],
  );
  const value = useMemo(() => ({ pending, navigate }), [pending, navigate]);
  return <FilterNavContext.Provider value={value}>{children}</FilterNavContext.Provider>;
}

export function useFilterNav(): FilterNav {
  const value = useContext(FilterNavContext);
  if (!value) throw new Error("useFilterNav must be used inside <FilterShell>");
  return value;
}

/** Wraps the results: marks them busy and dims them while new ones are loading. */
export function ResultsRegion({ children }: { children: ReactNode }) {
  const { pending } = useFilterNav();
  return (
    <div aria-busy={pending} className={`transition-opacity ${pending ? "opacity-50" : ""}`}>
      <p role="status" className="sr-only">
        {pending ? "Updating results" : ""}
      </p>
      {children}
    </div>
  );
}
