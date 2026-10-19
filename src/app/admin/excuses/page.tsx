import { fmt } from "@/components/ui";
import { canManageGroup, requireStaff } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { reviewExcuse } from "../actions";
import { AddExcuseForm } from "./add-excuse-form";

export default async function ExcusesPage({ searchParams }: { searchParams: Promise<{ meetingId?: string; userId?: string }> }) {
  const initial = await searchParams; // pre-filled from a member's "Excuse" link on the Members page
  const staff = await requireStaff();
  const repo = getRepo();
  const [allExcuses, profiles, meetings, groups, memberships] = await Promise.all([
    repo.listExcuses(), repo.listProfiles(), repo.listMeetings(), repo.listGroups(), repo.listGroupMembers(),
  ]);
  const meetingGroup = new Map(meetings.map((m) => [m.id, m.groupId]));
  const excuses = allExcuses.filter((e) => canManageGroup(staff, meetingGroup.get(e.meetingId) ?? null));
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const titles = new Map(meetings.map((m) => [m.id, m]));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const fullBody = profiles.filter((p) => p.active && p.role === "member").map((p) => p.id);
  const activeIds = new Set(profiles.filter((p) => p.active).map((p) => p.id));
  const excuseMeetings = meetings
    .filter((m) => canManageGroup(staff, m.groupId))
    .slice(0, 30)
    .map((m) => ({
      id: m.id,
      label: `${m.title}${m.groupId ? ` (${groupName.get(m.groupId)})` : ""}, ${fmt(m.startsAt)}`,
      memberIds: m.groupId ? memberships.filter((x) => x.groupId === m.groupId && activeIds.has(x.userId)).map((x) => x.userId) : fullBody,
    }));
  const memberOptions = profiles.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Excuses</h1>
      <AddExcuseForm meetings={excuseMeetings} members={memberOptions} initial={initial} />
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Member</th><th>Meeting</th><th>Reason</th><th>Status</th></tr></thead>
          <tbody>
            {excuses.map((e) => (
              <tr key={e.id}>
                <td>{names.get(e.userId)}</td>
                <td>{titles.get(e.meetingId)?.title}<div className="muted text-xs">{fmt(titles.get(e.meetingId)?.startsAt ?? null)}</div></td>
                <td className="max-w-xs whitespace-pre-wrap">{e.reason}</td>
                <td>
                  {e.status === "pending" ? (
                    <form action={reviewExcuse} className="flex gap-1">
                      <input type="hidden" name="excuseId" value={e.id} />
                      <button name="decision" value="approved" className="btn py-1 text-xs">Approve</button>
                      <button name="decision" value="rejected" className="btn-ghost py-1 text-xs">Reject</button>
                    </form>
                  ) : <span className="capitalize">{e.status}</span>}
                </td>
              </tr>
            ))}
            {excuses.length === 0 && <tr><td colSpan={4} className="muted">No requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
