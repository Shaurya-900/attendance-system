import Link from "next/link";
import { fmt, LevelBadge } from "@/components/ui";
import { standings } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { createSemester } from "./actions";

export default async function AdminDashboard() {
  const repo = getRepo();
  const [profiles, meetings, pending, audit, semesters, { semester, byUser }] = await Promise.all([
    repo.listProfiles(), repo.listMeetings(), repo.listExcuses({ status: "pending" }), repo.listAudit(200), repo.listSemesters(), standings(repo),
  ]);
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const atRisk = profiles
    .filter((p) => p.active && p.role === "member" && byUser.get(p.id)!.level !== "ok")
    .sort((a, b) => byUser.get(b.id)!.points - byUser.get(a.id)!.points);
  const proxyEvents = audit.filter((a) => a.action.startsWith("proxy.")).slice(0, 10);
  const live = meetings.filter((m) => m.status === "live");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {live.map((m) => (
        <Link key={m.id} href={`/admin/meetings/${m.id}/live`} className="card block border-l-4" style={{ borderLeftColor: "var(--accent)" }}>
          <strong>Live now:</strong> {m.title} — open projector view →
        </Link>
      ))}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold">Members at risk {semester && <span className="muted text-xs">({semester.name})</span>}</h2>
          {atRisk.length === 0 && <p className="muted text-sm">Everyone is in good standing.</p>}
          {atRisk.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span>{p.name}</span><LevelBadge level={byUser.get(p.id)!.level} points={byUser.get(p.id)!.points} />
            </div>
          ))}
        </section>
        <section className="card space-y-2">
          <h2 className="font-semibold">Suspected proxy attempts</h2>
          {proxyEvents.length === 0 && <p className="muted text-sm">None recorded.</p>}
          {proxyEvents.map((e) => (
            <p key={e.id} className="text-sm"><strong>{names.get(e.actorId ?? "") ?? "Unknown"}</strong> — {e.action.replace("proxy.", "").replace(/_/g, " ")} <span className="muted">{fmt(e.createdAt)}</span></p>
          ))}
          <p className="muted text-xs">Check-ins with device flags are also highlighted on each meeting page.</p>
        </section>
      </div>
      <section className="card flex items-center justify-between text-sm">
        <span>{pending.length} excuse request(s) waiting</span>
        <Link href="/admin/excuses" className="btn-ghost">Review</Link>
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Semesters</h2>
        <p className="muted text-xs">Strikes reset at each semester boundary. Current: {semester?.name ?? "none (counting all time)"}</p>
        <ul className="text-sm">{semesters.map((s) => <li key={s.id}>{s.name}: {s.startsOn} → {s.endsOn}</li>)}</ul>
        <form action={createSemester} className="grid gap-2 sm:grid-cols-4">
          <input name="name" className="input" placeholder="e.g. Odd sem 2026" required />
          <input name="startsOn" type="date" className="input" required />
          <input name="endsOn" type="date" className="input" required />
          <button className="btn">Add semester</button>
        </form>
      </section>
    </div>
  );
}
