import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link className="btn-ghost" href="/admin">Dashboard</Link>
        <Link className="btn-ghost" href="/admin/meetings">Meetings</Link>
        <Link className="btn-ghost" href="/admin/members">Members</Link>
        <Link className="btn-ghost" href="/admin/excuses">Excuses</Link>
        <a className="btn-ghost" href="/api/admin/export">Export CSV</a>
      </nav>
      {children}
    </div>
  );
}
