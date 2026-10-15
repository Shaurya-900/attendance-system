"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Highlights immediately on click, before the next page has loaded. */
export function NavLink({ href, exact = false, className = "", children }: { href: string; exact?: boolean; className?: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    // prefetch: load the full page (data included) in the background as soon as the link is
    // on screen, so clicking it shows the finished page straight away.
    <Link href={href} prefetch className={`${className} ${active ? "font-semibold text-[var(--accent)]" : ""}`} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
