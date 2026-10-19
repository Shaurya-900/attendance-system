import Link from "next/link";
import { LevelBadge, StrikeHoles } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { scopeLabel, standings, type ScopeStanding } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import type { MemberChanges, Profile, RosterEntry } from "@/lib/types";
import { ConfirmForm } from "@/components/confirm-form";
import { ImportRosterForm } from "./import-roster-form";
import { ActionForm, EditMemberForm, ReviewEditForm, StrikeForm } from "./member-forms";
import { deleteMember, deleteRosterEntry, resetPasskey, setActive, setApprover } from "../actions";

type Filters = { q?: string; role?: string; status?: string; team?: string };

const CHANGE_LABEL: Record<keyof MemberChanges, string> = { name: "Name", rollNo: "Roll no.", email: "SNU mail ID", role: "Rights" };
const RANK = { ok: 0, warning: 1, flagged: 2 } as const;
const ROLE_LABEL = { member: "", admin: "Admin", advisor: "Advisor" } as const;

/** A small label next to a name: rights, status. Written in ink, no fill. */
function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "red" | "pencil" | "accent" }) {
  const color = `var(--${tone})`;
  return <span className="tag" style={{ color }}>{children}</span>;
}

/** The disclosure chevron, drawn rather than typed. */
function Chevron() {
  return (
    <svg className="chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

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

  // Each member's counts: full body only for members (admins and advisors aren't tracked there), never for advisors.
  const scopesOf = (p: Profile): ScopeStanding[] =>
    p.role === "advisor" ? [] : (byUser.get(p.id) ?? []).filter((s) => s.group || p.role === "member");
  const rankOf = (p: Profile) => Math.max(0, ...scopesOf(p).map((s) => RANK[s.summary.level]));

  // Search and filters come from the URL, so a filtered list can be bookmarked or shared.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const inTeam = new Set([
    ...memberships.filter((m) => m.groupId === team).map((m) => byId.get(m.userId)?.email),
    ...reserved.filter((r) => r.groupId === team).map((r) => r.email),
  ]);
  const matches = (p: Profile | RosterEntry, active: boolean | null) =>
    words.every((w) => `${p.name} ${p.email} ${p.rollNo ?? ""}`.toLowerCase().includes(w)) &&
    (!role || (role === "approver" ? p.role === "admin" && "approver" in p && !!p.approver : p.role === role)) &&
    (!status || (status === "not_joined" ? active === null : status === (active ? "active" : "inactive"))) &&
    (!team || inTeam.has(p.email));
  const allNotJoined = roster.filter((r) => !signedUp.has(r.email));
  // Flagged first, then warnings, then everyone else by name, so the people who need attention are on top.
  const shownProfiles = profiles.filter((p) => matches(p, p.active))
    .sort((a, b) => rankOf(b) - rankOf(a) || a.name.localeCompare(b.name));
  const notJoined = allNotJoined.filter((r) => matches(r, null));
  const filtering = !!(q || role || status || team);
  const flagged = profiles.filter((p) => rankOf(p) === RANK.flagged).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Members</h1>
        <p className="muted text-sm tabular-nums">
          {profiles.length} signed up · {allNotJoined.length} not signed in yet
          {flagged > 0 && <> · <Link href="#members" className="font-semibold text-[var(--red)]">{flagged} flagged</Link></>}
        </p>
      </div>

      {!anyApprover && (
        <p className="alert">
          Nobody can approve member edits yet, so other admins&apos; edits will wait. Whoever set up the app can make you an approver (see &ldquo;approver&rdquo; in the README).
        </p>
      )}

      {edits.length > 0 && (
        <details className="card disclosure" id="approvals">
          <summary>
            <span className="font-semibold">{edits.length} {edits.length === 1 ? "edit" : "edits"} waiting for approval</span>
            <Chevron />
          </summary>
          <ul className="mt-3 divide-y text-sm" style={{ borderColor: "var(--border)" }}>
            {edits.map((e) => {
              const name = nameOf.get(e.targetEmail) ?? e.targetEmail;
              return (
                <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="space-y-1">
                    <div><strong>{name}</strong> <span className="muted text-xs">requested by {byId.get(e.requestedBy ?? "")?.name ?? "a former admin"}</span></div>
                    <ul className="muted text-xs">
                      {(Object.keys(e.changes) as (keyof MemberChanges)[]).map((k) => (
                        <li key={k}>{CHANGE_LABEL[k]}: <span className="text-[var(--fg)]">{k === "role" ? (e.changes.role === "admin" ? "Admin" : "Member (removes admin rights)") : e.changes[k] || "none"}</span></li>
                      ))}
                    </ul>
                  </div>
                  {isApprover ? <ReviewEditForm editId={e.id} name={name} /> : <span className="muted text-xs">An approver has to accept this.</span>}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <details className="card disclosure">
        <summary>
          <span className="font-semibold">Import members from Excel</span>
          <Chevron />
        </summary>
        <div className="mt-3"><ImportRosterForm /></div>
      </details>

      <form method="get" role="search" aria-label="Find members" className="flex flex-wrap gap-2">
        <div className="flex w-full gap-2 lg:w-auto lg:flex-1">
          <input name="q" defaultValue={q} className="input" placeholder="Name, SNU mail ID or roll no." aria-label="Search members" />
          <button className="btn">Search</button>
        </div>
        <select name="role" defaultValue={role} className="input min-w-0 flex-1 lg:w-auto lg:flex-none" aria-label="Rights">
          <option value="">Everyone</option>
          <option value="member">Members</option>
          <option value="admin">Admins</option>
          <option value="approver">Approvers</option>
          <option value="advisor">Advisors</option>
        </select>
        <select name="status" defaultValue={status} className="input min-w-0 flex-1 lg:w-auto lg:flex-none" aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="not_joined">Not signed in yet</option>
        </select>
        <select name="team" defaultValue={team} className="input min-w-0 flex-1 lg:w-auto lg:flex-none" aria-label="Team">
          <option value="">All teams</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        {filtering && <Link href="/admin/members" className="btn-ghost btn-tall">Clear</Link>}
      </form>

      {filtering && (
        <p className="muted text-sm tabular-nums" aria-live="polite">
          Showing {shownProfiles.length} of {profiles.length} signed up and {notJoined.length} of {allNotJoined.length} not signed in yet.
        </p>
      )}
      {filtering && shownProfiles.length + notJoined.length === 0 && (
        <p className="text-sm">Nobody matches. <Link href="/admin/members" className="underline underline-offset-4">Clear the filters</Link> to see everyone.</p>
      )}

      {shownProfiles.length > 0 && (
        <section id="members" aria-labelledby="signed-up-heading" className="space-y-2">
          <h2 id="signed-up-heading" className="font-semibold">Signed up <span className="muted font-normal tabular-nums">({shownProfiles.length})</span></h2>
          <ul className="card member-list">
            {shownProfiles.map((p) => {
              const scopes = scopesOf(p);
              const self = p.id === admin.id;
              const phone = hasPasskey.has(p.id);
              return (
                <li key={p.id}>
                  <article aria-label={p.name}>
                    <details className="member-row">
                      <summary>
                        <span className="min-w-0">
                          <span className={`font-semibold ${p.active ? "" : "muted"}`}>{p.name}</span>
                          <span className="ml-2 inline-flex flex-wrap gap-x-2 align-baseline">
                            {p.rollNo && <span className="muted text-xs tabular-nums">{p.rollNo}</span>}
                            {ROLE_LABEL[p.role] && <Tag tone="accent">{ROLE_LABEL[p.role]}</Tag>}
                            {p.role === "admin" && p.approver && <Tag tone="accent">Approver</Tag>}
                            {rankOf(p) === RANK.flagged && <Tag tone="red">Flagged</Tag>}
                            {rankOf(p) === RANK.warning && <Tag tone="pencil">Warning</Tag>}
                            {!p.active && <Tag tone="red">Inactive</Tag>}
                            {!phone && <Tag>No phone</Tag>}
                          </span>
                        </span>
                        <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
                          {p.role === "advisor" && <span className="muted">No attendance requirement</span>}
                          {scopes.map((s) => (
                            <span key={s.group?.id ?? "all"} className="inline-flex items-center gap-1" title={`${scopeLabel(s)}: ${s.summary.points} pts`}>
                              <span className="muted">{scopeLabel(s)}</span> <StrikeHoles points={s.summary.points} size="0.5rem" />
                            </span>
                          ))}
                        </span>
                        <Chevron />
                      </summary>

                      <div className="member-detail">
                        <p className="muted break-all text-xs">{[p.email, p.rollNo, p.role === "member" ? "Member" : ROLE_LABEL[p.role]].filter(Boolean).join(" · ")}</p>

                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold">Standing{semester && <span className="muted font-normal"> ({semester.name})</span>}</h3>
                          {scopes.length === 0 && <p className="muted text-xs">{p.role === "advisor" ? "Advisor, no attendance requirement." : "Admin, not tracked for full body. Not in any group yet."}</p>}
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {scopes.map((s) => (
                              <div key={s.group?.id ?? "all"} className="flex items-center gap-1 text-xs">
                                <span className="muted">{scopeLabel(s)}:</span> <LevelBadge level={s.summary.level} points={s.summary.points} />
                              </div>
                            ))}
                          </div>
                        </div>

                        {scopes.length > 0 && (
                          <div className="space-y-1">
                            <h3 className="text-sm font-semibold">Adjust strikes</h3>
                            <StrikeForm userId={p.id} name={p.name} semesterId={semester?.id ?? ""}
                              scopes={scopes.map((s) => ({ value: s.group?.id ?? "", label: scopeLabel(s) }))} />
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="text-sm font-semibold">Phone</h3>
                          <span className="text-sm">{phone ? "Registered" : "Not registered yet"}</span>
                          {phone && (
                            <ActionForm action={resetPasskey} fields={{ userId: p.id }} label="Reset phone" name={`Reset ${p.name}'s phone`} pendingLabel="Resetting…"
                              confirm={`Reset ${p.name}'s phone? They'll need to register their phone again before their next check-in.`} />
                          )}
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold">Details</h3>
                          <EditMemberForm member={p} isApprover={isApprover} isSelf={self} />
                          {isApprover && p.role === "admin" && !self && (
                            <ActionForm action={setApprover} fields={{ userId: p.id, approver: String(!p.approver) }}
                              label={p.approver ? "Remove approver rights" : "Make approver"}
                              name={p.approver ? `Remove ${p.name}'s approver rights` : `Make ${p.name} an approver`}
                              confirm={p.approver ? `Remove ${p.name}'s approver rights? Their member edits will need approval again.` : undefined} />
                          )}
                        </div>

                        {!self && (
                          <div className="danger-zone">
                            <h3 className="text-sm font-semibold text-[var(--red)]">Danger zone</h3>
                            <div className="flex flex-wrap items-start gap-2">
                              <ActionForm action={setActive} fields={{ userId: p.id, active: String(!p.active) }}
                                label={p.active ? "Deactivate" : "Reactivate"} name={`${p.active ? "Deactivate" : "Reactivate"} ${p.name}`}
                                confirm={p.active ? `Deactivate ${p.name}? They can't sign in or check in until reactivated. Their records are kept.` : undefined} />
                              <ConfirmForm
                                action={deleteMember}
                                fields={{ userId: p.id }}
                                label="Delete"
                                className="btn-ghost text-sm text-[var(--red)]"
                                confirm={`Delete ${p.name}? Their login, attendance, excuses and group memberships are removed and they can't sign in again unless re-added. This can't be undone.`}
                              />
                            </div>
                            <p className="muted text-xs">Deactivating keeps their history; deleting removes it for good.</p>
                          </div>
                        )}
                      </div>
                    </details>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {notJoined.length > 0 && (
        <section aria-labelledby="not-joined-heading" className="space-y-2">
          <h2 id="not-joined-heading" className="font-semibold">Not signed in yet <span className="muted font-normal tabular-nums">({notJoined.length})</span></h2>
          <ul className="card member-list">
            {notJoined.map((r) => (
              <li key={r.email}>
                <article aria-label={r.name}>
                  <details className="member-row">
                    <summary>
                      <span className="min-w-0">
                        <span className="font-semibold">{r.name}</span>
                        <span className="ml-2 inline-flex flex-wrap gap-x-2 align-baseline">
                          {r.rollNo && <span className="muted text-xs tabular-nums">{r.rollNo}</span>}
                          {ROLE_LABEL[r.role] && <Tag tone="accent">{ROLE_LABEL[r.role]}</Tag>}
                        </span>
                      </span>
                      <span className="muted break-all text-right text-xs">{r.email}</span>
                      <Chevron />
                    </summary>
                    <div className="member-detail">
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Details</h3>
                        <EditMemberForm member={r} isApprover={isApprover} isSelf={false} />
                      </div>
                      <div className="danger-zone">
                        <h3 className="text-sm font-semibold text-[var(--red)]">Danger zone</h3>
                        <ConfirmForm action={deleteRosterEntry} fields={{ email: r.email }} label="Remove" pendingLabel="Removing…"
                          className="btn-ghost text-sm text-[var(--red)]" confirm={`Remove ${r.name} (${r.email})? They won't be able to sign in.`} />
                      </div>
                    </div>
                  </details>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
