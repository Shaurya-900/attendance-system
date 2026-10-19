import Link from "next/link";
import { LevelBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { scopeLabel, standings } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import type { MemberChanges } from "@/lib/types";
import { ConfirmForm } from "@/components/confirm-form";
import { ImportRosterForm } from "./import-roster-form";
import { EditMemberForm, ReviewEditForm } from "./member-forms";
import { adjustStrikes, deleteMember, deleteRosterEntry, resetPasskey, setActive, setApprover } from "../actions";

type Filters = { q?: string; role?: string; status?: string; team?: string };

const CHANGE_LABEL: Record<keyof MemberChanges, string> = { name: "Name", rollNo: "Roll no.", email: "SNU mail ID", role: "Rights" };

export default async function MembersPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const admin = await requireAdmin();
  const { q = "", role = "", status = "", team = "" } = await searchParams;
  const repo = getRepo();
  const [profiles, roster, passkeys, groups, memberships, reserved, edits, { semester, byUser }] = await Promise.all([
    repo.listProfiles(), repo.listRoster(), repo.listPasskeys(), repo.listGroups(), repo.listGroupMembers(),
    repo.listRosterGroups(), repo.listMemberEdits("pending"), standings(repo),
  ]);
  const hasPasskey = new Set(passkeys.map((p) => p.userId));
  const signedUp = new Set(profiles.map((p) => p.email));
  const nameOf = new Map([...roster, ...profiles].map((p) => [p.email, p.name]));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const isApprover = !!admin.approver;
  const anyApprover = profiles.some((p) => p.role === "admin" && p.approver);

  // Search and filters come from the URL, so a filtered list can be bookmarked or shared.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const inTeam = new Set([
    ...memberships.filter((m) => m.groupId === team).map((m) => byId.get(m.userId)?.email),
    ...reserved.filter((r) => r.groupId === team).map((r) => r.email),
  ]);
  const matches = (p: { name: string; email: string; rollNo: string | null; role: string }, active: boolean | null) =>
    words.every((w) => `${p.name} ${p.email} ${p.rollNo ?? ""}`.toLowerCase().includes(w)) &&
    (!role || (role === "approver" ? p.role === "admin" && "approver" in p && p.approver : p.role === role)) &&
    (!status || (status === "not_joined" ? active === null : status === (active ? "active" : "inactive"))) &&
    (!team || inTeam.has(p.email));
  const shownProfiles = profiles.filter((p) => matches(p, p.active));
  const notJoined = roster.filter((r) => !signedUp.has(r.email) && matches(r, null));
  const filtering = !!(q || role || status || team);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Members</h1>

      {edits.length > 0 && (
        <section className="card space-y-3" aria-label="Edits waiting for approval">
          <h2 className="font-semibold">Waiting for approval ({edits.length})</h2>
          <ul className="space-y-3 text-sm">
            {edits.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
                <div className="space-y-1">
                  <div><strong>{nameOf.get(e.targetEmail) ?? e.targetEmail}</strong> <span className="muted text-xs">requested by {byId.get(e.requestedBy ?? "")?.name ?? "a former admin"}</span></div>
                  <ul className="muted text-xs">
                    {(Object.keys(e.changes) as (keyof MemberChanges)[]).map((k) => (
                      <li key={k}>{CHANGE_LABEL[k]}: <span className="text-[var(--fg)]">{k === "role" ? (e.changes.role === "admin" ? "Admin" : "Member (removes admin rights)") : e.changes[k] || "none"}</span></li>
                    ))}
                  </ul>
                </div>
                {isApprover ? <ReviewEditForm editId={e.id} /> : <span className="muted text-xs">An approver has to accept this.</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!anyApprover && (
        <p className="alert">
          Nobody can approve member edits yet. In Supabase&apos;s SQL editor, run{" "}
          <code className="break-all">update profiles set approver = true where email = &apos;your SNU mail ID&apos;;</code>
        </p>
      )}

      <form method="get" className="card grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]" role="search">
        <input name="q" defaultValue={q} className="input" placeholder="Search name, SNU mail ID or roll no." aria-label="Search members" />
        <select name="role" defaultValue={role} className="input" aria-label="Rights">
          <option value="">Everyone</option>
          <option value="member">Members</option>
          <option value="admin">Admins</option>
          <option value="approver">Approvers</option>
        </select>
        <select name="status" defaultValue={status} className="input" aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="not_joined">Not signed in yet</option>
        </select>
        <select name="team" defaultValue={team} className="input" aria-label="Team">
          <option value="">All teams</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn">Search</button>
          {filtering && <Link href="/admin/members" className="btn-ghost">Clear</Link>}
        </div>
      </form>
      {filtering && <p className="muted text-sm">{shownProfiles.length + notJoined.length} of {profiles.length + roster.filter((r) => !signedUp.has(r.email)).length} shown.</p>}

      {/* One card per member: readable on phones, and a two-column grid on wider screens. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {shownProfiles.map((p) => {
          const scopes = (byUser.get(p.id) ?? []).filter((s) => s.group || p.role === "member");
          return (
            <article key={p.id} aria-label={p.name} className={`card space-y-3 ${p.active ? "" : "opacity-50"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="muted break-all text-xs">{p.email} · {p.rollNo} · {p.role}{p.role === "admin" && p.approver ? " · approver" : ""}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isApprover && p.role === "admin" && p.id !== admin.id && (
                    <form action={setApprover}>
                      <input type="hidden" name="userId" value={p.id} />
                      <input type="hidden" name="approver" value={String(!p.approver)} />
                      <button className="btn-ghost text-xs">{p.approver ? "Remove approver" : "Make approver"}</button>
                    </form>
                  )}
                  <form action={setActive}>
                    <input type="hidden" name="userId" value={p.id} />
                    <input type="hidden" name="active" value={String(!p.active)} />
                    <button className="btn-ghost text-xs">{p.active ? "Deactivate" : "Reactivate"}</button>
                  </form>
                  {p.id !== admin.id && (
                    <ConfirmForm
                      action={deleteMember}
                      fields={{ userId: p.id }}
                      label="Delete"
                      confirm={`Delete ${p.name}? Their login, attendance, excuses and group memberships are removed and they can't sign in again unless re-added. This can't be undone.`}
                    />
                  )}
                </div>
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

              <EditMemberForm member={p} isApprover={isApprover} isSelf={p.id === admin.id} />
            </article>
          );
        })}
        {filtering && shownProfiles.length === 0 && <p className="muted text-sm">No signed-up members match.</p>}
      </div>

      <ImportRosterForm />

      {notJoined.length > 0 && (
        <div className="card">
          <h2 className="font-semibold">Added, not signed in yet ({notJoined.length})</h2>
          <ul className="mt-2 divide-y text-sm" style={{ borderColor: "var(--border)" }}>
            {notJoined.map((r) => (
              <li key={r.email} className="space-y-1 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{r.name} <span className="muted break-all text-xs">{r.email} · {r.rollNo} · {r.role}</span></span>
                  <ConfirmForm action={deleteRosterEntry} fields={{ email: r.email }} label="Remove" pendingLabel="Removing…" confirm={`Remove ${r.name} (${r.email})? They won't be able to sign in.`} />
                </div>
                <EditMemberForm member={r} isApprover={isApprover} isSelf={false} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
