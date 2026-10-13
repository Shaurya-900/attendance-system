import { NavLink } from "@/components/nav-link";
import { requireStaff } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin } = await requireStaff();
  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 text-sm">
        {isAdmin && <NavLink className="btn-ghost" href="/admin" exact>Dashboard</NavLink>}
        <NavLink className="btn-ghost" href="/admin/meetings">Meetings</NavLink>
        <NavLink className="btn-ghost" href="/admin/groups">Groups</NavLink>
        {isAdmin && <NavLink className="btn-ghost" href="/admin/members">Members</NavLink>}
        <NavLink className="btn-ghost" href="/admin/excuses">Excuses</NavLink>
        {isAdmin && <a className="btn-ghost" href="/api/admin/export">Export CSV</a>}
      </nav>
      {children}
    </div>
  );
}
