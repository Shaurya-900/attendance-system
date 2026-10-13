import { notFound, redirect } from "next/navigation";
import { LevelBadge } from "@/components/ui";
import { canManageGroup, requireStaff } from "@/lib/auth";
import { isGroupActive, standings } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { GROUP_KIND_LABEL } from "@/lib/types";
import { removeGroupMember, setGroupArchived, setGroupRole } from "../../actions";
import { AddMembersForm } from "./add-members-form";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff();
  if (!canManageGroup(staff, id)) redirect("/admin/groups");
  const repo = getRepo();
  const [group, members, profiles, { semester, byUser }] = await Promise.all([
    repo.getGroup(id), repo.listGroupMembers(id), repo.listProfiles(), standings(repo),
  ]);
  if (!group) notFound();
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const memberIds = new Set(members.map((m) => m.userId));
  const candidates = profiles.filter((p) => p.active && !memberIds.has(p.id)).map((p) => ({ id: p.id, name: p.name, rollNo: p.rollNo }));
  const rows = members
    .map((m) => ({ m, p: byId.get(m.userId), s: byUser.get(m.userId)?.find((x) => x.group?.id === id)?.summary }))
    .filter((r) => r.p)
    .sort((a, b) => (a.m.role === b.m.role ? a.p!.name.localeCompare(b.p!.name) : a.m.role === "lead" ? -1 : 1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{group.name}</h1>
        <span className="muted text-sm">
          {GROUP_KIND_LABEL[group.kind]}
          {group.endsOn ? ` · until ${group.endsOn}` : ""}
          {!isGroupActive(group) ? " · archived" : ""}
        </span>
        {staff.isAdmin && (
          <form action={setGroupArchived} className="ml-auto">
            <input type="hidden" name="groupId" value={id} />
            <input type="hidden" name="archived" value={String(!group.archived)} />
            <button className="btn-ghost text-xs">{group.archived ? "Unarchive" : "Archive"}</button>
          </form>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Member</th><th>Role</th><th>Group strikes {semester && <span className="font-normal">({semester.name})</span>}</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ m, p, s }) => (
              <tr key={m.userId}>
                <td>{p!.name} <span className="muted text-xs">{p!.rollNo}</span></td>
                <td>
                  {staff.isAdmin ? (
                    <form action={setGroupRole}>
                      <input type="hidden" name="groupId" value={id} />
                      <input type="hidden" name="userId" value={m.userId} />
                      <input type="hidden" name="role" value={m.role === "lead" ? "member" : "lead"} />
                      <span className="capitalize">{m.role}</span>{" "}
                      <button className="btn-ghost py-0.5 text-xs">{m.role === "lead" ? "Make member" : "Make lead"}</button>
                    </form>
                  ) : <span className="capitalize">{m.role}</span>}
                </td>
                <td>{s && <LevelBadge level={s.level} points={s.points} />}</td>
                <td>
                  {(staff.isAdmin || m.role !== "lead") && (
                    <form action={removeGroupMember}>
                      <input type="hidden" name="groupId" value={id} />
                      <input type="hidden" name="userId" value={m.userId} />
                      <button className="btn-ghost py-0.5 text-xs">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted">No members yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <AddMembersForm groupId={id} candidates={candidates} />
      <p className="muted text-xs">Only people who have signed in to the app once can be added. Removing someone keeps their past attendance.</p>
    </div>
  );
}
