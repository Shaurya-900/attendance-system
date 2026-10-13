import Link from "next/link";
import { fmt } from "@/components/ui";
import { getRepo } from "@/lib/repo";
import { NewMeetingForm } from "./new-meeting-form";

export default async function MeetingsPage() {
  const repo = getRepo();
  const [meetings, attendance] = await Promise.all([repo.listMeetings(), repo.listAllAttendance()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Meetings</h1>
      <NewMeetingForm />
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Title</th><th>Starts</th><th>Status</th><th>Checked in</th></tr></thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id}>
                <td><Link className="underline" href={`/admin/meetings/${m.id}`}>{m.title}</Link></td>
                <td>{fmt(m.startsAt)}</td>
                <td className="capitalize">{m.status}</td>
                <td>{attendance.filter((a) => a.meetingId === m.id && (a.status === "present" || a.status === "late")).length}</td>
              </tr>
            ))}
            {meetings.length === 0 && <tr><td colSpan={4} className="muted">No meetings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
