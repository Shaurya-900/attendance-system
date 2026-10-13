import { fmt, LevelBadge, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { EXCUSE_WINDOW_MS, standings } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { FLAGGED_AT, WARNING_AT } from "@/lib/strikes";
import { requestExcuse } from "./actions";

export default async function MePage() {
  const user = await requireUser("/me");
  const repo = getRepo();
  const [meetings, records, excuses, { semester, byUser }] = await Promise.all([
    repo.listMeetings(), repo.listAttendanceForUser(user.id), repo.listExcuses({ userId: user.id }), standings(repo),
  ]);
  const summary = byUser.get(user.id)!;
  const recordFor = new Map(records.map((r) => [r.meetingId, r]));
  const excuseFor = new Map(excuses.map((e) => [e.meetingId, e]));
  const now = Date.now();
  const excusable = meetings.filter((m) => {
    const r = recordFor.get(m.id);
    return (!r || r.status === "absent") && !excuseFor.has(m.id) && now <= new Date(m.startsAt).getTime() + EXCUSE_WINDOW_MS;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">My attendance</h1>
        <LevelBadge level={summary.level} points={summary.points} />
      </div>

      {summary.level !== "ok" && (
        <p role="alert" className={`rounded-lg p-3 text-sm ${summary.level === "flagged" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
          {summary.level === "flagged"
            ? `You've reached ${FLAGGED_AT} strikes. The core team will review your membership.`
            : `You're at ${summary.points} strikes. At ${FLAGGED_AT} your membership goes for review.`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Strike points", summary.points], ["Absences", summary.absences], ["Lates", summary.lates], ["Excused", summary.excused]].map(([k, v]) => (
          <div key={k} className="card"><div className="muted text-xs">{k}</div><div className="text-2xl font-bold">{v}</div></div>
        ))}
      </div>
      <p className="muted text-xs">
        {semester ? `Semester: ${semester.name}. ` : "No semester configured — counting all meetings. "}
        Absence = 1 point, late = 0.5, approved excuse = 0. Warning at {WARNING_AT}, review at {FLAGGED_AT}.
      </p>

      {excusable.length > 0 && (
        <form action={requestExcuse} className="card space-y-2">
          <h2 className="font-semibold">Request an excuse</h2>
          <select name="meetingId" className="input" required>
            {excusable.map((m) => <option key={m.id} value={m.id}>{m.title} — {fmt(m.startsAt)}</option>)}
          </select>
          <textarea name="reason" className="input" required minLength={5} maxLength={500} placeholder="Reason (e.g. exam, medical)" />
          <button className="btn">Submit</button>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Meeting</th><th>When</th><th>Status</th><th>Excuse</th></tr></thead>
          <tbody>
            {meetings.map((m) => {
              const r = recordFor.get(m.id);
              const e = excuseFor.get(m.id);
              return (
                <tr key={m.id}>
                  <td>{m.title}</td>
                  <td>{fmt(m.startsAt)}</td>
                  <td>{r ? <StatusBadge status={r.status} /> : <span className="muted">{m.status === "closed" ? "—" : m.status}</span>}</td>
                  <td className="capitalize">{e?.status ?? ""}</td>
                </tr>
              );
            })}
            {meetings.length === 0 && <tr><td colSpan={4} className="muted">No meetings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
