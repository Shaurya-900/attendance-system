import Link from "next/link";
import { fmt, GroupBadge } from "@/components/ui";
import { canManageGroup, requireStaff } from "@/lib/auth";
import { isGroupActive } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { NewMeetingForm } from "./new-meeting-form";

export default async function MeetingsPage() {
  const staff = await requireStaff();
  const repo = getRepo();
  const [allMeetings, attendance, groups] = await Promise.all([repo.listMeetings(), repo.listAllAttendance(), repo.listGroups()]);
  const meetings = allMeetings.filter((m) => canManageGroup(staff, m.groupId));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const audiences = [
    ...(staff.isAdmin ? [{ id: "", label: "Full body (all members)" }] : []),
    ...groups.filter((g) => isGroupActive(g) && canManageGroup(staff, g.id)).map((g) => ({ id: g.id, label: g.name })),
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Meetings</h1>
      <NewMeetingForm audiences={audiences} />
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Title</th><th>For</th><th>Starts</th><th>Status</th><th>Checked in</th></tr></thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id}>
                <td><Link className="underline" href={`/admin/meetings/${m.id}`}>{m.title}</Link></td>
                <td><GroupBadge name={m.groupId ? groupName.get(m.groupId) : null} /></td>
                <td>{fmt(m.startsAt)}</td>
                <td className="capitalize">{m.status}</td>
                <td>{attendance.filter((a) => a.meetingId === m.id && (a.status === "present" || a.status === "late")).length}</td>
              </tr>
            ))}
            {meetings.length === 0 && <tr><td colSpan={5} className="muted">No meetings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
