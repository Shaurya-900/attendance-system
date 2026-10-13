import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getCurrentUser, getStaff } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = { title: "E-Cell Attendance", description: "Proxy-proof attendance with a 3-strike rule" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const staff = user ? await getStaff(user) : null;
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b" style={{ borderColor: "var(--border)" }}>
          <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3 text-sm">
            <Link href="/" className="font-bold">E-Cell Attendance</Link>
            {user && <Link href="/me">My attendance</Link>}
            {staff?.isAdmin && <Link href="/admin">Admin</Link>}
            {staff && !staff.isAdmin && staff.ledGroupIds.size > 0 && <Link href="/admin/meetings">Manage groups</Link>}
            {user && (
              <form action="/api/auth/logout" method="post" className="ml-auto flex items-center gap-3">
                <span className="muted hidden sm:inline">{user.name}</span>
                <button className="btn-ghost">Sign out</button>
              </form>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
