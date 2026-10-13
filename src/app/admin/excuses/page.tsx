import { fmt } from "@/components/ui";
import { getRepo } from "@/lib/repo";
import { reviewExcuse } from "../actions";

export default async function ExcusesPage() {
  const repo = getRepo();
  const [excuses, profiles, meetings] = await Promise.all([repo.listExcuses(), repo.listProfiles(), repo.listMeetings()]);
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const titles = new Map(meetings.map((m) => [m.id, m]));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Excuse requests</h1>
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
