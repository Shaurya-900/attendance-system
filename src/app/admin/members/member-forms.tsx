"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import type { Role } from "@/lib/types";
import { requestMemberEdit, reviewMemberEdit } from "../actions";

/** Edit a member's details. Approvers' edits apply at once; other admins' go to an approver. */
export function EditMemberForm({ member, isApprover, isSelf }: {
  member: { name: string; rollNo: string | null; email: string; role: Role };
  isApprover: boolean;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(requestMemberEdit, null);
  return (
    <details className="text-sm">
      <summary className="btn-ghost inline-flex cursor-pointer text-xs">Edit details</summary>
      <form action={action} className="mt-2 grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="targetEmail" value={member.email} />
        <label className="space-y-1">
          <span className="muted text-xs">Name</span>
          <input name="name" className="input" defaultValue={member.name} required maxLength={80} />
        </label>
        <label className="space-y-1">
          <span className="muted text-xs">Roll number</span>
          <input name="rollNo" className="input" defaultValue={member.rollNo ?? ""} inputMode="numeric" pattern="2\d{9}" title="10 digits starting with 2" />
        </label>
        <label className="space-y-1">
          <span className="muted text-xs">SNU mail ID</span>
          <input name="email" type="email" className="input" defaultValue={member.email} required />
        </label>
        <label className="space-y-1">
          <span className="muted text-xs">Rights</span>
          {/* Nobody changes their own rights, so they can't lock themselves out. */}
          <select name="role" className="input" defaultValue={member.role} disabled={isSelf}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          {isSelf && <input type="hidden" name="role" value={member.role} />}
        </label>
        <div className="space-y-1 sm:col-span-2">
          <button className="btn" disabled={pending}>{pending ? "Saving…" : isApprover ? "Save" : "Send for approval"}</button>
          {!isApprover && <p className="muted text-xs">An approver has to accept this before it changes anything.</p>}
          <FormMessage state={state} />
        </div>
      </form>
    </details>
  );
}

/** Approve or reject a pending member edit. */
export function ReviewEditForm({ editId }: { editId: string }) {
  const [state, action, pending] = useActionState(reviewMemberEdit, null);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="editId" value={editId} />
      <div className="flex gap-2">
        <button name="decision" value="approve" className="btn py-1 text-xs" disabled={pending}>Approve</button>
        <button name="decision" value="reject" className="btn-ghost text-xs text-[var(--red)]" disabled={pending}>Reject</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
