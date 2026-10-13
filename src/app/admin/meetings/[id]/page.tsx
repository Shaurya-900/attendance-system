import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flags, fmt, GroupBadge, StatusBadge } from "@/components/ui";
import { canManageGroup, requireStaff } from "@/lib/auth";
import { expectedMembers } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { endMeeting, overrideAttendance, startMeeting } from "../../actions";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff();
  const repo = getRepo();
  const meeting = await repo.getMeeting(id);
  if (!meeting) notFound();
  if (!canManageGroup(staff, meeting.groupId)) redirect("/admin/meetings");
  const [records, profiles, expected, group] = await Promise.all([
    repo.listAttendanceForMeeting(id), repo.listProfiles(), expectedMembers(repo, meeting),
    meeting.groupId ? repo.getGroup(meeting.groupId) : null,
  ]);
  const recordFor = new Map(records.map((r) => [r.userId, r]));
  // Everyone expected, plus anyone with a record (e.g. removed from the group afterwards).
  const expectedIds = new Set(expected.map((p) => p.id));
  const members = profiles.filter((p) => expectedIds.has(p.id) || recordFor.has(p.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{meeting.title}</h1>
        <GroupBadge name={group?.name} />
        <span className="muted text-sm capitalize">{meeting.status} · {fmt(meeting.startsAt)} · late after {meeting.graceMinutes} min</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {meeting.status === "scheduled" && (
          <form action={startMeeting}><input type="hidden" name="meetingId" value={id} /><button className="btn">Start check-in</button></form>
        )}
        {meeting.status === "live" && <Link className="btn" href={`/admin/meetings/${id}/live`}>Projector view</Link>}
        {meeting.status !== "closed" && (
          <form action={endMeeting}><input type="hidden" name="meetingId" value={id} /><button className="btn-ghost">Close meeting &amp; mark absentees</button></form>
        )}
        {meeting.status === "closed" && expected.some((p) => !recordFor.has(p.id)) && (
          <form action={endMeeting}><input type="hidden" name="meetingId" value={id} /><button className="btn-ghost">Mark remaining absentees</button></form>
        )}
        <a className="btn-ghost" href={`/api/admin/export?meeting=${id}`}>Export CSV</a>
      </div>

      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Member</th><th>Status</th><th>Checked in</th><th>Override</th></tr></thead>
          <tbody>
            {members.map((p) => {
              const r = recordFor.get(p.id);
              return (
                <tr key={p.id}>
                  <td>{p.name} <span className="muted text-xs">{p.rollNo}</span></td>
                  <td>{r ? <StatusBadge status={r.status} /> : <span className="muted">—</span>}{r && <Flags flags={r.flags} />}{r?.source === "manual" && r.checkedInAt && <span className="muted text-xs"> (edited)</span>}</td>
                  <td>{fmt(r?.checkedInAt ?? null)}</td>
                  <td>
                    <form action={overrideAttendance} className="flex flex-wrap gap-1">
                      <input type="hidden" name="meetingId" value={id} />
                      <input type="hidden" name="userId" value={p.id} />
                      <select name="status" defaultValue={r?.status ?? "present"} className="input w-auto py-1 text-xs">
                        {["present", "late", "absent", "excused"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <input name="reason" required placeholder="Reason" className="input w-28 py-1 text-xs" />
                      <button className="btn-ghost py-1 text-xs">Save</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted text-xs">Flags: <strong>device mismatch</strong> = checked in from a different phone than the one registered; <strong>new device</strong> = phone had no device ID (cleared data / new browser). Review these before trusting the record.</p>
    </div>
  );
}
