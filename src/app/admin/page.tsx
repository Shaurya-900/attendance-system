import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { fmt, LevelBadge } from "@/components/ui";
import { scopeLabel, standings } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { SemesterList } from "./semester-list";
import { SemesterForm } from "./semester-form";

export default async function AdminDashboard() {
  const staff = await requireStaff();
  if (!staff.isAdmin) redirect("/admin/meetings");
  const repo = getRepo();
  const [profiles, meetings, pending, audit, semesters, roster, { semester, byUser }] = await Promise.all([
    repo.listProfiles(), repo.listMeetings(), repo.listExcuses({ status: "pending" }), repo.listAudit(200), repo.listSemesters(),
    repo.listRoster(), standings(repo),
  ]);
  const joined = new Set(profiles.map((p) => p.email));
  const notJoined = roster.filter((r) => r.role === "member" && !joined.has(r.email));
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  // One row per member per strike count (full body or a group) that is at warning or worse.
  const atRisk = profiles
    .filter((p) => p.active)
    .flatMap((p) => (byUser.get(p.id) ?? [])
      .filter((s) => s.summary.level !== "ok" && (s.group || p.role === "member"))
      .map((s) => ({ p, s })))
    .sort((a, b) => b.s.summary.points - a.s.summary.points);
  const proxyEvents = audit.filter((a) => a.action.startsWith("proxy.")).slice(0, 10);
  const live = meetings.filter((m) => m.status === "live");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {live.map((m) => (
        <Link key={m.id} href={`/admin/meetings/${m.id}/live`} className="card block border-l-4" style={{ borderLeftColor: "var(--accent)" }}>
          <strong>Live now:</strong> {m.title}. Open projector view
        </Link>
      ))}
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-2">
          <h2 className="font-semibold">Defaulters {semester && <span className="muted text-xs">({semester.name})</span>}</h2>
          {atRisk.length === 0 && <p className="muted text-sm">Everyone is in good standing.</p>}
          {atRisk.map(({ p, s }) => (
            <div key={`${p.id}:${s.group?.id ?? "all"}`} className="flex items-center justify-between gap-2 text-sm">
              <span>{p.name} <span className="muted text-xs">· {scopeLabel(s)}</span></span>
              <LevelBadge level={s.summary.level} points={s.summary.points} />
            </div>
          ))}
        </section>
        <section className="card space-y-2">
          <h2 className="font-semibold">Suspected proxy attempts</h2>
          {proxyEvents.length === 0 && <p className="muted text-sm">None recorded.</p>}
          {proxyEvents.map((e) => (
            <p key={e.id} className="text-sm"><strong>{names.get(e.actorId ?? "") ?? "Unknown"}</strong>: {e.action.replace("proxy.", "").replace(/_/g, " ")} <span className="muted">{fmt(e.createdAt)}</span></p>
          ))}
          <p className="muted text-xs">Check-ins with device flags are also highlighted on each meeting page.</p>
        </section>
      </div>
      {notJoined.length > 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-2 border-l-4 text-sm" style={{ borderLeftColor: "var(--pencil)" }}>
          <span>
            <strong>{notJoined.length}</strong> added member(s) haven&apos;t signed in yet. Meetings they miss are marked absent when they first sign in.
          </span>
          <Link href="/admin/members" className="btn-ghost">See who</Link>
        </section>
      )}
      <section className="card flex items-center justify-between text-sm">
        <span>{pending.length} excuse request(s) waiting</span>
        <Link href="/admin/excuses" className="btn-ghost">Review</Link>
      </section>
      <section className="card space-y-3">
        <h2 className="font-semibold">Semesters</h2>
        <p className="muted text-xs">Strikes reset at each semester boundary. Current: {semester?.name ?? "none (counting all time)"}</p>
        <SemesterList semesters={semesters} />
        <SemesterForm />
      </section>
    </div>
  );
}
