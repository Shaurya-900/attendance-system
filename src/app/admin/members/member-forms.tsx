"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useActionState, useContext, useId, useState } from "react";
import { FormMessage } from "@/components/form-message";
import type { Role } from "@/lib/types";
import { adjustStrikes, requestMemberEdit, reviewMemberEdit, type FormState } from "../actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/* Results that outlive their row. Delete, Remove, Approve and Reset phone change or remove the row the
   button sits in, so their message is shown in a bar at the bottom of the screen instead. */
const Outcome = createContext<(state: FormState) => void>(() => {});

export function OutcomeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FormState>(null);
  return (
    <Outcome.Provider value={setState}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {state && (
          <div className={`toast ${state.error ? "toast-error" : ""}`}>
            <p>{state.error ?? state.ok}</p>
            <button type="button" className="btn-ghost" onClick={() => setState(null)}>Dismiss</button>
          </div>
        )}
      </div>
    </Outcome.Provider>
  );
}

/**
 * Wrap an action so its result also goes to the bottom bar. It's reported from the action itself, not an
 * effect, because the same render that brings the result can remove the row (and this form) entirely.
 */
function useReported(action: Action, enabled: boolean): Action {
  const report = useContext(Outcome);
  return enabled ? async (prev, formData) => { const result = await action(prev, formData); report(result); return result; } : action;
}

/**
 * One button that runs an action and says what happened. `confirm` asks first, for actions that are hard to undo.
 * `name` is what a screen reader hears: it starts with the visible label, then says whose row it is,
 * so voice control ("click Reset phone") still works. `toast` shows the result in the bottom bar.
 */
export function ActionForm({ action, fields, label, name, pendingLabel = "Saving…", confirm, toast = false, className = "btn-ghost text-sm" }: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  name?: string;
  pendingLabel?: string;
  confirm?: string;
  toast?: boolean;
  className?: string;
}) {
  const [state, run, pending] = useActionState(useReported(action, toast), null);
  return (
    <form action={run} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} className="space-y-1">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={className} disabled={pending} aria-label={name}>{pending ? pendingLabel : label}</button>
      {!toast && <FormMessage state={state} />}
    </form>
  );
}

type Section = { key: string; label: string; node: React.ReactNode };

/**
 * A member's opened row: standing first, then one section at a time (Adjust strikes, Edit details, Phone),
 * the rare and risky actions behind "More", and a Close button at the bottom.
 * `review` is shown first for flagged or warned members, with a shortcut into Adjust strikes.
 */
export function MemberPanel({ name, standing, review, sections, more }: {
  name: string;
  standing: React.ReactNode;
  review?: { missed: React.ReactNode; deactivate?: React.ReactNode };
  sections: Section[];
  more?: React.ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  const all = more ? [...sections, { key: "more", label: "More", node: more }] : sections;
  const active = all.find((s) => s.key === open);
  const hasStrikes = sections.some((s) => s.key === "strikes");
  return (
    <div className="member-detail">
      {standing}
      {review && (
        <div className="review">
          <h3 className="text-sm font-semibold">To review</h3>
          {review.missed}
          <div className="flex flex-wrap items-start gap-2">
            {hasStrikes && <button type="button" className="btn-ghost text-sm" onClick={() => setOpen("strikes")}>Adjust strikes</button>}
            {review.deactivate}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Actions for ${name}`}>
        {all.map((s) => (
          <button key={s.key} type="button" className={`btn-ghost text-sm ${open === s.key ? "is-open" : ""}`}
            aria-expanded={open === s.key} aria-controls={`${id}-${s.key}`} onClick={() => setOpen(open === s.key ? null : s.key)}>
            {s.label}
          </button>
        ))}
      </div>
      {active && <div id={`${id}-${active.key}`} className="panel-section">{active.node}</div>}
      <button type="button" className="btn-ghost justify-self-start text-sm"
        onClick={(e) => {
          const details = e.currentTarget.closest("details");
          if (details) { details.open = false; details.querySelector("summary")?.focus(); }
        }}>
        Close
      </button>
    </div>
  );
}

/** Add or remove strike points, in one of the member's counts (full body or a group). */
export function StrikeForm({ userId, name, semesterId, scopes }: {
  userId: string;
  name: string;
  semesterId: string;
  scopes: { value: string; label: string }[];
}) {
  const [state, run, pending] = useActionState(adjustStrikes, null);
  // React clears a form after each submit. An error sends back what was typed, and the form is
  // re-created from it (the key), because a dropdown doesn't pick up a changed default on its own.
  const typed = state?.values ?? {};
  return (
    <form key={JSON.stringify(typed)} action={run} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="semesterId" value={semesterId} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_7rem_1fr]">
        <label className="col-span-2 space-y-1 sm:col-span-1">
          <span className="muted block text-xs">Count</span>
          <select name="groupId" className="input text-sm" defaultValue={typed.groupId}>
            {scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="muted block text-xs">Points (− to remove)</span>
          <input name="points" type="number" step="0.5" min={-10} max={10} required placeholder="-1" className="input text-sm tabular-nums" defaultValue={typed.points} />
        </label>
        <label className="space-y-1">
          <span className="muted block text-xs">Reason</span>
          <input name="reason" required placeholder="e.g. Excused late" className="input text-sm" defaultValue={typed.reason} />
        </label>
      </div>
      <button className="btn-ghost text-sm" disabled={pending} aria-label={`Adjust strikes for ${name}`}>
        {pending ? "Saving…" : "Adjust strikes"}
      </button>
      <p className="muted text-xs">Half points are allowed. Use a minus sign to take points away.</p>
      <FormMessage state={state} />
    </form>
  );
}

/** Edit a member's details. Approvers' edits apply at once; other admins' go to an approver. */
export function EditMemberForm({ member, isApprover, isSelf }: {
  member: { name: string; rollNo: string | null; email: string; role: Role };
  isApprover: boolean;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(requestMemberEdit, null);
  const [role, setRole] = useState<Role>(member.role);
  const typed = state?.values ?? {}; // what was typed, sent back with an error
  const label = isApprover ? "Save changes" : "Send for approval";
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="targetEmail" value={member.email} />
      <label className="space-y-1">
        <span className="muted text-xs">Name</span>
        <input name="name" className="input" defaultValue={typed.name ?? member.name} required maxLength={80} />
      </label>
      <label className="space-y-1">
        <span className="muted text-xs">Roll number</span>
        <input name="rollNo" className="input tabular-nums" defaultValue={typed.rollNo ?? member.rollNo ?? ""} inputMode="numeric" pattern="2\d{9}" title="10 digits starting with 2" />
      </label>
      <label className="space-y-1">
        <span className="muted text-xs">SNU mail ID</span>
        <input name="email" type="email" className="input" defaultValue={typed.email ?? member.email} required />
      </label>
      {/* Advisors are set in the database only, and nobody changes their own rights (so nobody locks themselves out). */}
      {member.role === "advisor" || isSelf ? (
        <div className="space-y-1">
          <span className="muted block text-xs">Rights</span>
          <p className="py-2 text-sm">{member.role === "advisor" ? "Advisor (set in the database)" : `${member.role === "admin" ? "Admin" : "Member"} (you can't change your own)`}</p>
          <input type="hidden" name="role" value={member.role} />
        </div>
      ) : (
        <label className="space-y-1">
          <span className="muted text-xs">Rights</span>
          <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      )}
      <div className="space-y-1 sm:col-span-2">
        {member.role === "admin" && role === "member" && (
          <p role="alert" className="alert alert-error">This removes {member.name}&apos;s admin rights{isApprover ? "" : " once approved"}. They&apos;ll lose access to the admin pages.</p>
        )}
        <button className="btn" disabled={pending} aria-label={`${label} for ${member.name}`}>{pending ? "Saving…" : label}</button>
        {!isApprover && <p className="muted text-xs">An approver has to accept this before it changes anything.</p>}
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Approve or reject a pending member edit. The item disappears once handled, so the result goes to the bottom bar. */
export function ReviewEditForm({ editId, name }: { editId: string; name: string }) {
  const [, action, pending] = useActionState(useReported(reviewMemberEdit, true), null);
  return (
    <form action={action}>
      <input type="hidden" name="editId" value={editId} />
      <div className="flex gap-2">
        <button name="decision" value="approve" className="btn" disabled={pending} aria-label={`Approve the edit to ${name}`}>Approve</button>
        <button name="decision" value="reject" className="btn-ghost btn-tall text-[var(--red)]" disabled={pending} aria-label={`Reject the edit to ${name}`}>Reject</button>
      </div>
    </form>
  );
}

type FilterValues = { q: string; role: string; status: string; team: string; standing: string; phone: string };

/**
 * Search plus a Filters panel. Dropdowns apply as soon as they change (no Search press needed);
 * it's still a plain GET form, so it works before the page has loaded and every list has its own URL.
 */
export function MemberFilters({ values, groups }: { values: FilterValues; groups: { id: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const active = (["role", "status", "team", "standing", "phone"] as const).filter((k) => values[k]).length;
  const apply = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (v) params.set(k, String(v));
    const query = params.toString();
    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  };
  const select = (name: keyof FilterValues, label: string, options: [string, string][]) => (
    <label className="space-y-1">
      <span className="muted block text-xs">{label}</span>
      <select name={name} defaultValue={values[name]} className="input" onChange={(e) => apply(e.currentTarget.form!)}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
  return (
    <form method="get" role="search" aria-label="Find members" className="space-y-2" onSubmit={(e) => { e.preventDefault(); apply(e.currentTarget); }}>
      <div className="flex gap-2">
        <input name="q" defaultValue={values.q} className="input" placeholder="Name, SNU mail ID or roll no." aria-label="Search members" />
        <button className="btn">Search</button>
      </div>
      <details className="disclosure" open={active > 0}>
        <summary className="text-sm font-semibold">
          <span>Filters{active > 0 && <span className="muted font-normal"> ({active} on)</span>}</span>
          <svg className="chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4" /></svg>
        </summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {select("standing", "Standing", [["", "Any standing"], ["flagged", "Flagged"], ["warning", "Warning"]])}
          {select("status", "Status", [["", "Any status"], ["active", "Active"], ["inactive", "Inactive"], ["not_joined", "Not signed in yet"]])}
          {select("phone", "Phone", [["", "Any"], ["none", "No phone registered"], ["registered", "Registered"]])}
          {select("role", "Rights", [["", "Everyone"], ["member", "Members"], ["admin", "Admins"], ["approver", "Approvers"], ["advisor", "Advisors"]])}
          {select("team", "Team", [["", "All teams"], ...groups.map((g): [string, string] => [g.id, g.name])])}
        </div>
      </details>
    </form>
  );
}
