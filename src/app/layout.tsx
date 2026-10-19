import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser, getStaff } from "@/lib/auth";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import "./globals.css";
import logo from "./icon.png";

// Self-hosted at build time: no request to Google from the browser, no layout shift.
const body = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = { title: "E-Cell Attendance", description: "Proxy-proof attendance with a 3-strike rule" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f6fb" }, { media: "(prefers-color-scheme: dark)", color: "#0d1224" }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const staff = user ? await getStaff(user) : null;
  const saved = (await cookies()).get(THEME_COOKIE)?.value;
  const theme: Theme = saved === "light" || saved === "dark" ? saved : "system";
  return (
    <html lang="en" className={body.variable} data-theme={theme === "system" ? undefined : theme}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-sm [&>a]:py-2">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <Image src={logo} alt="" width={28} height={28} priority />
              E-Cell Attendance
            </Link>
            {user && <NavLink href="/me">My attendance</NavLink>}
            {staff?.isAdmin && <NavLink href="/admin">Admin</NavLink>}
            {staff && !staff.isAdmin && staff.ledGroupIds.size > 0 && <NavLink href="/admin/meetings">Manage groups</NavLink>}
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle initial={theme} />
              {user && (
                <form action="/api/auth/logout" method="post" className="flex items-center gap-3">
                  <span className="muted hidden sm:inline">{user.name}</span>
                  <button className="btn-ghost">Sign out</button>
                </form>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6 sm:py-8">{children}</main>
      </body>
    </html>
  );
}
