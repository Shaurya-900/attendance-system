import { fmt, GroupBadge, LevelBadge, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { EXCUSE_WINDOW_MS, scopeLabel, standingsForUser } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { FLAGGED_AT, WARNING_AT } from "@/lib/strikes";
import { ExcuseForm } from "./excuse-form";

export default async function MePage() {
  const user = await requireUser("/me");
  const repo = getRepo();
  const [{ semester, scopes: allScopes, meetings: allMeetings, attendance: records, groups, memberships }, excuses] = await Promise.all([
    standingsForUser(repo, user.id), repo.listExcuses({ userId: user.id }),
  ]);
  const myGroups = new Set(memberships.map((m) => m.groupId));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const recordFor = new Map(records.map((r) => [r.meetingId, r]));
  const excuseFor = new Map(excuses.map((e) => [e.meetingId, e]));
  // Meetings I'm expected at: full body (members), my groups' meetings, plus anything I have a record for.
  const meetings = allMeetings.filter((m) =>
    recordFor.has(m.id) || (m.groupId ? myGroups.has(m.groupId) : user.role === "member"));
  const scopes = allScopes.filter((s) => s.group || user.role === "member");
  const now = Date.now();
  const excusable = meetings.filter((m) => {
    const r = recordFor.get(m.id);
    return (!r || r.status === "absent") && !excuseFor.has(m.id) && now <= new Date(m.startsAt).getTime() + EXCUSE_WINDOW_MS;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My attendance</h1>

      {scopes.map((s) => s.summary.level !== "ok" && (
        <p key={`warn-${s.group?.id ?? "all"}`} role="alert" className={`rounded-lg p-3 text-sm ${s.summary.level === "flagged" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>
          <strong>{scopeLabel(s)}:</strong>{" "}
          {s.summary.level === "flagged"
            ? `You've reached ${FLAGGED_AT} strikes. The core team will review this.`
            : `You're at ${s.summary.points} strikes. At ${FLAGGED_AT} it goes for review.`}
        </p>
      ))}

      <div className="grid gap-3 sm:grid-cols-2">
        {scopes.map((s) => (
          <section key={s.group?.id ?? "all"} className="card space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{scopeLabel(s)}</h2>
              <LevelBadge level={s.summary.level} points={s.summary.points} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {[["Absences", s.summary.absences], ["Lates", s.summary.lates], ["Excused", s.summary.excused]].map(([k, v]) => (
                <div key={k}><div className="text-xl font-bold">{v}</div><div className="muted text-xs">{k}</div></div>
              ))}
            </div>
          </section>
        ))}
        {scopes.length === 0 && <p className="muted text-sm">You&apos;re not tracked in any group yet.</p>}
      </div>
      <p className="muted text-xs">
        {semester ? `Semester: ${semester.name}. ` : "No semester configured — counting all meetings. "}
        Full body and each of your groups keep separate counts. Absence = 1 point, late = 0.5, approved excuse = 0.
        Warning at {WARNING_AT}, review at {FLAGGED_AT}.
      </p>

      {excusable.length > 0 && (
        <ExcuseForm meetings={excusable.map((m) => ({ id: m.id, label: `${m.title}${m.groupId ? ` (${groupName.get(m.groupId)})` : ""} — ${fmt(m.startsAt)}` }))} />
      )}

      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Meeting</th><th>For</th><th>When</th><th>Status</th><th>Excuse</th></tr></thead>
          <tbody>
            {meetings.map((m) => {
              const r = recordFor.get(m.id);
              const e = excuseFor.get(m.id);
              return (
                <tr key={m.id}>
                  <td>{m.title}</td>
                  <td><GroupBadge name={m.groupId ? groupName.get(m.groupId) : null} /></td>
                  <td>{fmt(m.startsAt)}</td>
                  <td>{r ? <StatusBadge status={r.status} /> : <span className="muted">{m.status === "closed" ? "—" : m.status}</span>}</td>
                  <td className="capitalize">{e?.status ?? ""}</td>
                </tr>
              );
            })}
            {meetings.length === 0 && <tr><td colSpan={5} className="muted">No meetings yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
