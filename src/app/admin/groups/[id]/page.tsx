import { notFound, redirect } from "next/navigation";
import { LevelBadge } from "@/components/ui";
import { canManageGroup, requireStaff } from "@/lib/auth";
import { isGroupActive, standings } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { GROUP_KIND_LABEL } from "@/lib/types";
import { ConfirmForm } from "@/components/confirm-form";
import { deleteGroup, removeGroupMember, removeReservedMember, setGroupArchived, setGroupRole } from "../../actions";
import { AddMembersForm } from "./add-members-form";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff();
  if (!canManageGroup(staff, id)) redirect("/admin/groups");
  const repo = getRepo();
  const [group, members, profiles, roster, reserved, { semester, byUser }] = await Promise.all([
    repo.getGroup(id), repo.listGroupMembers(id), repo.listProfiles(), repo.listRoster(), repo.listRosterGroups({ groupId: id }), standings(repo),
  ]);
  if (!group) notFound();
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const memberIds = new Set(members.map((m) => m.userId));
  const candidates = profiles.filter((p) => p.active && !memberIds.has(p.id)).map((p) => ({ id: p.id, name: p.name, rollNo: p.rollNo }));
  // People on the roster who haven't signed in yet: they can be given a place now and join on first sign-in.
  const signedUp = new Set(profiles.map((p) => p.email));
  const reservedEmails = new Set(reserved.map((r) => r.email));
  const waiting = roster.filter((r) => reservedEmails.has(r.email) && !signedUp.has(r.email));
  const notJoined = roster.filter((r) => !signedUp.has(r.email) && !reservedEmails.has(r.email)).map((r) => ({ email: r.email, name: r.name, rollNo: r.rollNo }));
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
          {` · ${rows.length} member${rows.length === 1 ? "" : "s"}`}
          {waiting.length ? ` · ${waiting.length} waiting to sign in` : ""}
          {group.endsOn ? ` · until ${group.endsOn}` : ""}
          {!isGroupActive(group) ? " · archived" : ""}
        </span>
        {staff.isAdmin && (
          <div className="ml-auto flex gap-2">
            <form action={setGroupArchived}>
              <input type="hidden" name="groupId" value={id} />
              <input type="hidden" name="archived" value={String(!group.archived)} />
              <button className="btn-ghost text-xs">{group.archived ? "Unarchive" : "Archive"}</button>
            </form>
            <ConfirmForm
              action={deleteGroup}
              fields={{ groupId: id }}
              label="Delete group"
              confirm={`Delete "${group.name}"? This also deletes its meetings and their attendance and strikes. It can't be undone. To keep the history, use Archive instead.`}
            />
          </div>
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
            {waiting.map((r) => (
              <tr key={r.email}>
                <td>{r.name} <span className="muted text-xs">{r.rollNo}</span></td>
                <td className="muted text-xs">Waiting to sign in</td>
                <td></td>
                <td>
                  <form action={removeReservedMember}>
                    <input type="hidden" name="groupId" value={id} />
                    <input type="hidden" name="email" value={r.email} />
                    <button className="btn-ghost py-0.5 text-xs">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length + waiting.length === 0 && <tr><td colSpan={4} className="muted">No members yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <AddMembersForm groupId={id} candidates={candidates} notJoined={notJoined} />
      <p className="muted text-xs">People who haven&apos;t signed in yet join the group automatically the first time they do. Removing someone keeps their past attendance.</p>
    </div>
  );
}
