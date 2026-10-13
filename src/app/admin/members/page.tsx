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
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Member</th><th>Standing</th><th>Phone</th><th>Adjust strikes</th><th></th></tr></thead>
          <tbody>
            {profiles.map((p) => {
              const scopes = (byUser.get(p.id) ?? []).filter((s) => s.group || p.role === "member");
              return (
                <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                  <td>{p.name}<div className="muted text-xs">{p.email} · {p.rollNo} · {p.role}</div></td>
                  <td className="space-y-1">
                    {scopes.length === 0 && <span className="muted text-xs">admin</span>}
                    {scopes.map((s) => (
                      <div key={s.group?.id ?? "all"} className="flex items-center gap-1 text-xs">
                        <span className="muted">{scopeLabel(s)}:</span> <LevelBadge level={s.summary.level} points={s.summary.points} />
                      </div>
                    ))}
                  </td>
                  <td>
                    {hasPasskey.has(p.id) ? (
                      <form action={resetPasskey}>
                        <input type="hidden" name="userId" value={p.id} />
                        <span className="text-xs">Registered </span><button className="btn-ghost py-0.5 text-xs">Reset</button>
                      </form>
                    ) : <span className="muted text-xs">Not registered</span>}
                  </td>
                  <td>
                    <form action={adjustStrikes} className="flex flex-wrap gap-1">
                      <input type="hidden" name="userId" value={p.id} />
                      <input type="hidden" name="semesterId" value={semester?.id ?? ""} />
                      <select name="groupId" className="input w-auto py-1 text-xs" aria-label="Strike count">
                        {(byUser.get(p.id) ?? []).map((s) => <option key={s.group?.id ?? "all"} value={s.group?.id ?? ""}>{scopeLabel(s)}</option>)}
                      </select>
                      <input name="points" type="number" step="0.5" min={-10} max={10} required placeholder="±pts" className="input w-16 py-1 text-xs" />
                      <input name="reason" required placeholder="Reason" className="input w-28 py-1 text-xs" />
                      <button className="btn-ghost py-1 text-xs">Apply</button>
                    </form>
                  </td>
                  <td>
                    <form action={setActive}>
                      <input type="hidden" name="userId" value={p.id} />
                      <input type="hidden" name="active" value={String(!p.active)} />
                      <button className="btn-ghost py-1 text-xs">{p.active ? "Deactivate" : "Reactivate"}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form action={importRoster} className="card space-y-2">
        <h2 className="font-semibold">Import roster</h2>
        <p className="muted text-xs">Only people on the roster can sign in. One per line: <code>email,name,roll_no[,admin]</code>. Existing entries are updated.</p>
        <textarea name="csv" rows={5} className="input font-mono text-xs" placeholder={"asha@college.edu,Asha Rao,22BCE104\nlead@college.edu,Core Lead,21BCE001,admin"} />
        <button className="btn">Import</button>
      </form>

      {notJoined.length > 0 && (
        <div className="card">
          <h2 className="font-semibold">On roster, not signed in yet ({notJoined.length})</h2>
          <p className="muted text-sm">{notJoined.map((r) => r.name).join(", ")}</p>
        </div>
      )}
    </div>
  );
}
