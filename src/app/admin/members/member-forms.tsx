"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import type { Role } from "@/lib/types";
import { adjustStrikes, requestMemberEdit, reviewMemberEdit, type FormState } from "../actions";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * One button that runs an action and says what happened. `confirm` asks first, for actions that are hard to undo.
 * `label` is what's shown; `name` is what a screen reader hears, so it can say whose row the button acts on.
 */
export function ActionForm({ action, fields, label, name, pendingLabel = "Saving…", confirm, className = "btn-ghost text-sm" }: {
  action: Action;
  fields: Record<string, string>;
  label: string;
  name?: string;
  pendingLabel?: string;
  confirm?: string;
  className?: string;
}) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} onSubmit={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }} className="space-y-1">
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={className} disabled={pending} aria-label={name}>{pending ? pendingLabel : label}</button>
      <FormMessage state={state} />
    </form>
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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[auto_6rem_1fr_auto]">
        <label className="col-span-2 sm:col-span-1">
          <span className="sr-only">Which count</span>
          <select name="groupId" className="input text-sm" defaultValue={typed.groupId}>
            {scopes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Points, negative to remove</span>
          <input name="points" type="number" step="0.5" min={-10} max={10} required placeholder="Points" className="input text-sm tabular-nums" defaultValue={typed.points} />
        </label>
        <label>
          <span className="sr-only">Reason</span>
          <input name="reason" required placeholder="Reason" className="input text-sm" defaultValue={typed.reason} />
        </label>
        <button className="btn-ghost col-span-2 text-sm sm:col-span-1" disabled={pending} aria-label={`Adjust ${name}'s strikes`}>
          {pending ? "Saving…" : "Adjust"}
        </button>
      </div>
      <p className="muted text-xs">Use a minus sign to remove points, e.g. -1. Half points are allowed.</p>
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
  const locked = isSelf || member.role === "advisor";
  const typed = state?.values ?? {}; // what was typed, sent back with an error
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
      <label className="space-y-1">
        <span className="muted text-xs">Rights</span>
        {/* Nobody changes their own rights, so they can't lock themselves out. Advisors are set in the database only. */}
        <select name="role" className="input" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={locked}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
          {member.role === "advisor" && <option value="advisor">Advisor (set in database)</option>}
        </select>
        {locked && <input type="hidden" name="role" value={member.role} />}
      </label>
      <div className="space-y-1 sm:col-span-2">
        {member.role === "admin" && role === "member" && (
          <p role="alert" className="alert alert-error">This removes {member.name}&apos;s admin rights{isApprover ? "" : " once approved"}. They&apos;ll lose access to the admin pages.</p>
        )}
        <button className="btn" disabled={pending}>{pending ? "Saving…" : isApprover ? "Save changes" : "Send for approval"}</button>
        {!isApprover && <p className="muted text-xs">An approver has to accept this before it changes anything.</p>}
        <FormMessage state={state} />
      </div>
    </form>
  );
}

/** Approve or reject a pending member edit. */
export function ReviewEditForm({ editId, name }: { editId: string; name: string }) {
  const [state, action, pending] = useActionState(reviewMemberEdit, null);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="editId" value={editId} />
      <div className="flex gap-2">
        <button name="decision" value="approve" className="btn" disabled={pending} aria-label={`Approve the edit to ${name}`}>Approve</button>
        <button name="decision" value="reject" className="btn-ghost btn-tall text-[var(--red)]" disabled={pending} aria-label={`Reject the edit to ${name}`}>Reject</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
