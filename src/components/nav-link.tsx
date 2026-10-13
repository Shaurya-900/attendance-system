"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Highlights immediately on click, before the next page has loaded. */
export function NavLink({ href, exact = false, className = "", children }: { href: string; exact?: boolean; className?: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} className={`${className} ${active ? "font-semibold underline underline-offset-4" : ""}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
