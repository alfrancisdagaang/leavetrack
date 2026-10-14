"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/ui/nav";
import { NAV_ICON } from "@/components/ui/nav-icons";

const ITEM =
  "relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium text-nav-text lg:min-h-[86px] lg:gap-2.5 lg:rounded-none lg:px-1";

/** Main navigation. Client component only to mark the current page; items come from navItemsFor(role). */
export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-x-10">
        {items.map((item) => {
          const icon = NAV_ICON[item.key];
          const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const content = (
            <>
              {icon ? <Image src={icon} alt="" width={23} height={23} unoptimized /> : null}
              {item.label}
              {item.available ? null : <span className="text-xs">(soon)</span>}
              {current ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-4 hidden h-[3px] bg-nav-active lg:block"
                />
              ) : null}
            </>
          );
          return (
            <li key={item.key}>
              {item.available ? (
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className={`${ITEM} ${current ? "bg-white/10 font-semibold lg:bg-transparent" : "hover:bg-white/10 hover:text-white lg:hover:bg-transparent"}`}
                >
                  {content}
                </Link>
              ) : (
                <span aria-disabled="true" className={`${ITEM} opacity-60`}>
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
