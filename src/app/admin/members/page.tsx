import Link from "next/link";
import { fmt, LevelBadge, StrikeHoles } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { scopeLabel, standings, type ScopeStanding } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import type { MemberChanges, Profile, RosterEntry } from "@/lib/types";
import { ImportRosterForm } from "./import-roster-form";
import { ActionForm, EditMemberForm, MemberFilters, MemberPanel, OutcomeProvider, ReviewEditForm, StrikeForm } from "./member-forms";
import { deleteMember, deleteRosterEntry, resetPasskey, setActive, setApprover } from "../actions";

type Filters = { q?: string; role?: string; status?: string; team?: string; standing?: string; phone?: string };

const CHANGE_LABEL: Record<keyof MemberChanges, string> = { name: "Name", rollNo: "Roll no.", email: "SNU mail ID", role: "Rights" };
const RANK = { ok: 0, warning: 1, flagged: 2 } as const;
const ROLE_LABEL = { member: "", admin: "Admin", advisor: "Advisor" } as const;

/** A small label next to a name: rights, status. Written in ink, no fill. */
function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "red" | "pencil" | "accent" }) {
  return <span className="tag" style={{ color: `var(--${tone})` }}>{children}</span>;
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
  const { q = "", role = "", status = "", team = "", standing = "", phone = "" } = await searchParams;
  const repo = getRepo();
  const [profiles, roster, passkeys, groups, memberships, reserved, edits, { semester, byUser, meetings, attendance }] = await Promise.all([
    repo.listProfiles(), repo.listRoster(), repo.listPasskeys(), repo.listGroups(), repo.listGroupMembers(),
    repo.listRosterGroups(), repo.listMemberEdits("pending"), standings(repo),
  ]);
  const hasPasskey = new Set(passkeys.map((p) => p.userId));
  const signedUp = new Set(profiles.map((p) => p.email));
  const nameOf = new Map([...roster, ...profiles].map((p) => [p.email, p.name]));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const meetingById = new Map(meetings.map((m) => [m.id, m]));
  const isApprover = !!admin.approver;
  const anyApprover = profiles.some((p) => p.role === "admin" && p.approver);

  // Everyone shares one count across all meetings, except advisors, who have no attendance requirement.
  const scopesOf = (p: Profile): ScopeStanding[] => (p.role === "advisor" ? [] : byUser.get(p.id) ?? []);
  const rankOf = (p: Profile) => Math.max(0, ...scopesOf(p).map((s) => RANK[s.summary.level]));

  // Search and filters come from the URL, so a filtered list can be bookmarked or shared.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const inTeam = new Set([
    ...memberships.filter((m) => m.groupId === team).map((m) => byId.get(m.userId)?.email),
    ...reserved.filter((r) => r.groupId === team).map((r) => r.email),
  ]);
  const matches = (p: Profile | RosterEntry) =>
    words.every((w) => `${p.name} ${p.email} ${p.rollNo ?? ""}`.toLowerCase().includes(w)) &&
    (!role || (role === "approver" ? p.role === "admin" && "approver" in p && !!p.approver : p.role === role)) &&
    (!team || inTeam.has(p.email));
  // Standing, phone and active/inactive only make sense for people who have signed in.
  const matchesProfile = (p: Profile) => matches(p) &&
    (!status || (status === "active" ? p.active : status === "inactive" ? !p.active : false)) &&
    (!standing || rankOf(p) === (standing === "flagged" ? RANK.flagged : RANK.warning)) &&
    (!phone || (phone === "none") !== hasPasskey.has(p.id));
  const allNotJoined = roster.filter((r) => !signedUp.has(r.email));
  // Flagged first, then warnings, then everyone else by name, so the people who need attention are on top.
  const shownProfiles = profiles.filter(matchesProfile).sort((a, b) => rankOf(b) - rankOf(a) || a.name.localeCompare(b.name));
  const notJoined = !standing && !phone && (!status || status === "not_joined") ? allNotJoined.filter(matches) : [];
  const filtering = !!(q || role || status || team || standing || phone);
  const flagged = profiles.filter((p) => rankOf(p) === RANK.flagged).length;
  const noPhone = profiles.filter((p) => p.active && !hasPasskey.has(p.id)).length;

  /** The meetings a member was marked absent at this semester. */
  const missedFor = (p: Profile) => attendance
    .filter((a) => a.userId === p.id && a.status === "absent")
    .flatMap((a) => { const m = meetingById.get(a.meetingId); return m ? [m] : []; })
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));

  return (
    <OutcomeProvider>
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="muted text-sm tabular-nums">
            {profiles.length} signed up
            {allNotJoined.length > 0 && <> · <Link href="?status=not_joined" className="underline underline-offset-4">{allNotJoined.length} not signed in yet</Link></>}
            {flagged > 0 && <> · <Link href="?standing=flagged" className="font-semibold text-[var(--red)] underline underline-offset-4">{flagged} flagged</Link></>}
            {noPhone > 0 && <> · <Link href="?phone=none" className="underline underline-offset-4">{noPhone} without a phone</Link></>}
          </p>
        </div>

        {!anyApprover && (
          <p className="alert">Nobody can approve member edits yet, so other admins&apos; edits will wait. Ask the tech lead to make you an approver.</p>
        )}

        {edits.length > 0 && (
          <details className="card disclosure" id="approvals" open={isApprover}>
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

        {/* Re-created when the URL changes, so the fields always show the filters in use. */}
        <MemberFilters key={JSON.stringify({ q, role, status, team, standing, phone })} values={{ q, role, status, team, standing, phone }} groups={groups} />

        {filtering && (
          <p className="muted text-sm tabular-nums" aria-live="polite">
            {/* Only the counts that apply: "not signed in" has no signed-up half, and "0 of 0" says nothing. */}
            Showing {[
              status !== "not_joined" && `${shownProfiles.length} of ${profiles.length} signed up`,
              allNotJoined.length > 0 && !standing && !phone && `${notJoined.length} of ${allNotJoined.length} not signed in yet`,
            ].filter(Boolean).join(" and ") || "nobody"}.{" "}
            <Link href="/admin/members" className="underline underline-offset-4">Clear filters</Link>
          </p>
        )}
        {filtering && shownProfiles.length + notJoined.length === 0 && (
          <p className="text-sm">
            {status === "not_joined" && allNotJoined.length === 0 ? "Everyone on the roster has signed in."
              : standing === "flagged" ? "Nobody is flagged. Everyone is under 3 strikes."
              : phone === "none" ? "Everyone has registered a phone."
              : "Nobody matches these filters."}
          </p>
        )}

        {shownProfiles.length > 0 && (
          <section id="members" aria-labelledby="signed-up-heading" className="space-y-2">
            <h2 id="signed-up-heading" className="font-semibold">Signed up <span className="muted font-normal tabular-nums">({shownProfiles.length})</span></h2>
            <ul className="card member-list">
              {shownProfiles.map((p) => {
                const scopes = scopesOf(p);
                const self = p.id === admin.id;
                const registered = hasPasskey.has(p.id);
                const rank = rankOf(p);
                const missed = rank > RANK.ok ? missedFor(p) : [];
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
                              {rank === RANK.flagged && <Tag tone="red">Flagged</Tag>}
                              {rank === RANK.warning && <Tag tone="pencil">Warning</Tag>}
                              {!p.active && <Tag>Inactive</Tag>}
                            </span>
                          </span>
                          <span className="row-marks text-xs">
                            {p.role === "advisor" && <span className="muted">No attendance requirement</span>}
                            {scopes.map((s) => (
                              <span key={s.group?.id ?? "all"} className="inline-flex items-center gap-1">
                                <span className="muted">{scopeLabel(s)}</span> <StrikeHoles points={s.summary.points} size="0.5rem" />
                              </span>
                            ))}
                          </span>
                          <Chevron />
                        </summary>

                        <MemberPanel
                          name={p.name}
                          standing={
                            <div className="space-y-1">
                              <h3 className="text-sm font-semibold">Standing{semester && <span className="muted font-normal"> · {semester.name}</span>}</h3>
                              <p className="muted break-all text-xs">{p.email}</p>
                              {scopes.length === 0 && <p className="muted text-xs">Advisor, no attendance requirement.</p>}
                              <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {scopes.map((s) => (
                                  <div key={s.group?.id ?? "all"} className="flex items-center gap-1 text-xs">
                                    <span className="muted">{scopeLabel(s)}:</span> <LevelBadge level={s.summary.level} points={s.summary.points} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          }
                          review={rank > RANK.ok ? {
                            missed: missed.length ? (
                              <ul className="space-y-1 text-sm">
                                {missed.map((m) => (
                                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                                    <span>Missed <strong>{m.title}</strong> <span className="muted text-xs">{m.groupId ? groupName.get(m.groupId) : "Full body"} · {fmt(m.startsAt)}</span></span>
                                    <Link href={`/admin/excuses?meetingId=${m.id}&userId=${p.id}`} className="btn-ghost text-sm" aria-label={`Excuse ${p.name} for ${m.title}`}>Excuse</Link>
                                  </li>
                                ))}
                              </ul>
                            ) : <p className="muted text-xs">These points come from manual adjustments, not missed meetings.</p>,
                            deactivate: p.active && !self ? (
                              <ActionForm action={setActive} fields={{ userId: p.id, active: "false" }} label="Deactivate" name={`Deactivate ${p.name}`}
                                confirm={`Deactivate ${p.name}? They can't sign in or check in until reactivated. Their records are kept.`} />
                            ) : undefined,
                          } : undefined}
                          sections={[
                            ...(scopes.length > 0 ? [{ key: "strikes", label: "Adjust strikes", node: (
                              <StrikeForm userId={p.id} name={p.name} semesterId={semester?.id ?? ""} />
                            ) }] : []),
                            { key: "details", label: "Edit details", node: (
                              <div className="space-y-3">
                                <EditMemberForm member={p} isApprover={isApprover} isSelf={self} />
                                {isApprover && p.role === "admin" && !self && (
                                  <ActionForm action={setApprover} fields={{ userId: p.id, approver: String(!p.approver) }}
                                    label={p.approver ? "Remove approver rights" : "Make approver"} name={`${p.approver ? "Remove approver rights" : "Make approver"}: ${p.name}`}
                                    confirm={p.approver ? `Remove ${p.name}'s approver rights? Their member edits will need approval again.` : undefined} />
                                )}
                              </div>
                            ) },
                            { key: "phone", label: "Phone", node: (
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm">{registered ? "Registered" : "Not registered yet. They'll be asked to register when they first check in."}</span>
                                {registered && (
                                  <ActionForm action={resetPasskey} fields={{ userId: p.id }} label="Reset phone" name={`Reset phone for ${p.name}`} pendingLabel="Resetting…" toast
                                    confirm={`Reset ${p.name}'s phone? They'll need to register their phone again before their next check-in.`} />
                                )}
                              </div>
                            ) },
                          ]}
                          more={self ? undefined : (
                            <div className="danger-zone">
                              <div className="flex flex-wrap items-start gap-3">
                                <ActionForm action={setActive} fields={{ userId: p.id, active: String(!p.active) }}
                                  label={p.active ? "Deactivate" : "Reactivate"} name={`${p.active ? "Deactivate" : "Reactivate"} ${p.name}`}
                                  confirm={p.active ? `Deactivate ${p.name}? They can't sign in or check in until reactivated. Their records are kept.` : undefined} />
                                <ActionForm action={deleteMember} fields={{ userId: p.id }} label="Delete" name={`Delete ${p.name}`} pendingLabel="Deleting…" toast
                                  className="btn-ghost text-sm text-[var(--red)]"
                                  confirm={`Delete ${p.name}? Their login, attendance, excuses and group memberships are removed and they can't sign in again unless re-added. This can't be undone.`} />
                              </div>
                              <p className="muted text-xs">Deactivating keeps their history; deleting removes it for good.</p>
                            </div>
                          )}
                        />
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
                        <span className="row-marks muted break-all text-xs">{r.email}</span>
                        <Chevron />
                      </summary>
                      <MemberPanel
                        name={r.name}
                        standing={<p className="muted text-xs">Hasn&apos;t signed in yet. Strikes start counting from their first meeting after signing in.</p>}
                        sections={[{ key: "details", label: "Edit details", node: <EditMemberForm member={r} isApprover={isApprover} isSelf={false} /> }]}
                        more={
                          <div className="danger-zone">
                            <ActionForm action={deleteRosterEntry} fields={{ email: r.email }} label="Remove" name={`Remove ${r.name}`} pendingLabel="Removing…" toast
                              className="btn-ghost text-sm text-[var(--red)]" confirm={`Remove ${r.name} (${r.email})? They won't be able to sign in.`} />
                          </div>
                        }
                      />
                    </details>
                  </article>
                </li>
              ))}
            </ul>
          </section>
        )}

        <details className="card disclosure">
          <summary>
            <span className="font-semibold">Import members from Excel</span>
            <Chevron />
          </summary>
          <div className="mt-3"><ImportRosterForm /></div>
        </details>
      </div>
    </OutcomeProvider>
  );
}
