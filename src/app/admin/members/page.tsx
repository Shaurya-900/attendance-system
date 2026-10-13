import { LevelBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { scopeLabel, standings } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import { adjustStrikes, importRoster, resetPasskey, setActive } from "../actions";

export default async function MembersPage() {
  await requireAdmin();
  const repo = getRepo();
  const [profiles, roster, passkeys, { semester, byUser }] = await Promise.all([
    repo.listProfiles(), repo.listRoster(), repo.listPasskeys(), standings(repo),
  ]);
  const hasPasskey = new Set(passkeys.map((p) => p.userId));
  const signedUp = new Set(profiles.map((p) => p.email));
  const notJoined = roster.filter((r) => !signedUp.has(r.email));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Members</h1>
      {/* One card per member: readable on phones, and a two-column grid on wider screens. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {profiles.map((p) => {
          const scopes = (byUser.get(p.id) ?? []).filter((s) => s.group || p.role === "member");
          return (
            <article key={p.id} aria-label={p.name} className={`card space-y-3 ${p.active ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="muted break-all text-xs">{p.email} · {p.rollNo} · {p.role}</div>
                </div>
                <form action={setActive}>
                  <input type="hidden" name="userId" value={p.id} />
                  <input type="hidden" name="active" value={String(!p.active)} />
                  <button className="btn-ghost text-xs">{p.active ? "Deactivate" : "Reactivate"}</button>
                </form>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {scopes.length === 0 && <span className="muted text-xs">Admin, not tracked for full body</span>}
                {scopes.map((s) => (
                  <div key={s.group?.id ?? "all"} className="flex items-center gap-1 text-xs">
                    <span className="muted">{scopeLabel(s)}:</span> <LevelBadge level={s.summary.level} points={s.summary.points} />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="muted">Phone:</span>
                {hasPasskey.has(p.id) ? (
                  <form action={resetPasskey} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={p.id} />
                    <span>Registered</span><button className="btn-ghost text-xs">Reset phone</button>
                  </form>
                ) : <span>Not registered</span>}
              </div>

              <form action={adjustStrikes} className="grid grid-cols-[1fr_5rem] gap-2 sm:grid-cols-[auto_5rem_1fr_auto]">
                <input type="hidden" name="userId" value={p.id} />
                <input type="hidden" name="semesterId" value={semester?.id ?? ""} />
                <select name="groupId" className="input col-span-2 text-sm sm:col-span-1" aria-label="Strike count">
                  {(byUser.get(p.id) ?? []).map((s) => <option key={s.group?.id ?? "all"} value={s.group?.id ?? ""}>{scopeLabel(s)}</option>)}
                </select>
                <input name="points" type="number" step="0.5" min={-10} max={10} required placeholder="±pts" aria-label="Points to add or remove" className="input text-sm" />
                <input name="reason" required placeholder="Reason" aria-label="Reason" className="input col-span-2 text-sm sm:col-span-1" />
                <button className="btn-ghost col-span-2 justify-center text-sm sm:col-span-1">Adjust strikes</button>
              </form>
            </article>
          );
        })}
      </div>

      <form action={importRoster} className="card space-y-2">
        <h2 className="font-semibold">Import members</h2>
        <p className="muted text-xs">Only people added here can sign in. One per line: <code>email,name,roll_no[,admin]</code>. Existing entries are updated.</p>
        <textarea name="csv" rows={5} className="input font-mono text-xs" placeholder={"asha@college.edu,Asha Rao,22BCE104\nlead@college.edu,Core Lead,21BCE001,admin"} />
        <button className="btn">Import</button>
      </form>

      {notJoined.length > 0 && (
        <div className="card">
          <h2 className="font-semibold">Added, not signed in yet ({notJoined.length})</h2>
          <p className="muted text-sm">{notJoined.map((r) => r.name).join(", ")}</p>
        </div>
      )}
    </div>
  );
}
