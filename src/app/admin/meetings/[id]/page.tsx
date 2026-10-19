import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Flags, fmt, GroupBadge, StatusBadge } from "@/components/ui";
import { canManageGroup, requireStaff } from "@/lib/auth";
import { expectedFrom } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { ConfirmForm } from "@/components/confirm-form";
import { deleteMeeting, endMeeting, startMeeting } from "../../actions";
import { OverrideForm } from "./override-form";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaff();
  const repo = getRepo();
  const meeting = await repo.getMeeting(id);
  if (!meeting) notFound();
  if (!canManageGroup(staff, meeting.groupId)) redirect("/admin/meetings");
  const [records, profiles, groupMembers, group] = await Promise.all([
    repo.listAttendanceForMeeting(id), repo.listProfiles(),
    meeting.groupId ? repo.listGroupMembers(meeting.groupId) : [],
    meeting.groupId ? repo.getGroup(meeting.groupId) : null,
  ]);
  const expected = expectedFrom(profiles, groupMembers, meeting);
  const recordFor = new Map(records.map((r) => [r.userId, r]));
  // Everyone expected, plus anyone with a record (e.g. removed from the group afterwards).
  const expectedIds = new Set(expected.map((p) => p.id));
  const members = profiles.filter((p) => expectedIds.has(p.id) || recordFor.has(p.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{meeting.title}</h1>
        <GroupBadge name={group?.name} />
        <span className="muted text-sm"><span className="capitalize">{meeting.status}</span> · {fmt(meeting.startsAt)} · late after {meeting.graceMinutes} min</span>
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
        <ConfirmForm
          action={deleteMeeting}
          fields={{ meetingId: id }}
          label="Delete meeting"
          className="btn-ghost text-[var(--red)]"
          confirm={`Delete "${meeting.title}"? Its attendance and excuses are removed too, and any strikes from it disappear. This can't be undone.`}
        />
      </div>

      {/* On phones each row stacks into its own block; data-label names each cell. */}
      <div className="card overflow-x-auto">
        <table className="data stack" role="table">
          <thead role="rowgroup"><tr role="row"><th role="columnheader">Member</th><th role="columnheader">Status</th><th role="columnheader">Checked in</th><th role="columnheader">Override</th></tr></thead>
          <tbody role="rowgroup">
            {members.map((p) => {
              const r = recordFor.get(p.id);
              return (
                <tr key={p.id} role="row">
                  <td role="cell"><span className="font-semibold">{p.name}</span> <span className="muted text-xs tabular-nums">{p.rollNo}</span></td>
                  <td role="cell" data-label="Status">{r ? <StatusBadge status={r.status} /> : <span className="muted">-</span>}{r && <Flags flags={r.flags} />}{r?.source === "manual" && r.checkedInAt && <span className="muted text-xs"> (edited)</span>}</td>
                  <td role="cell" data-label="Checked in" className="tabular-nums">{fmt(r?.checkedInAt ?? null)}</td>
                  <td role="cell"><OverrideForm meetingId={id} userId={p.id} name={p.name} status={r?.status ?? null} /></td>
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
