import Link from "next/link";
import { canManageGroup, requireStaff } from "@/lib/auth";
import { isGroupActive } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { GROUP_KIND_LABEL as kindLabel } from "@/lib/types";
import { NewGroupForm } from "./new-group-form";


export default async function GroupsPage() {
  const staff = await requireStaff();
  const repo = getRepo();
  const [groups, members] = await Promise.all([repo.listGroups(), repo.listGroupMembers()]);
  const visible = groups.filter((g) => canManageGroup(staff, g.id));
  const active = visible.filter((g) => isGroupActive(g));
  const past = visible.filter((g) => !isGroupActive(g));
  const count = (id: string) => members.filter((m) => m.groupId === id).length;

  const list = (gs: typeof groups) => (
    <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
      {gs.map((g) => (
        <li key={g.id} className="flex items-center justify-between py-2 text-sm">
          <Link className="underline" href={`/admin/groups/${g.id}`}>{g.name}</Link>
          <span className="muted">{kindLabel[g.kind]} · {count(g.id)} members{g.endsOn ? ` · until ${g.endsOn}` : ""}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Groups</h1>
      <p className="muted text-sm">
        Groups hold their own meetings and keep their own 3-strike count, separate from full-body meetings.
        Leads can run their group&apos;s meetings and manage its members.
      </p>
      {staff.isAdmin && <NewGroupForm />}
      <section className="card">
        <h2 className="mb-1 font-semibold">Active</h2>
        {active.length ? list(active) : <p className="muted text-sm">No groups yet.</p>}
      </section>
      {past.length > 0 && (
        <section className="card">
          <h2 className="mb-1 font-semibold">Archived / ended</h2>
          {list(past)}
        </section>
      )}
    </div>
  );
}
