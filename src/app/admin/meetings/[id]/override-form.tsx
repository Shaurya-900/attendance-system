"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import type { AttendanceStatus } from "@/lib/types";
import { overrideAttendance } from "../../actions";

const STATUSES: AttendanceStatus[] = ["present", "late", "absent", "excused"];

/** Change one member's attendance by hand. Labels name the member, so a screen reader knows whose row it is. */
export function OverrideForm({ meetingId, userId, name, status }: { meetingId: string; userId: string; name: string; status: AttendanceStatus | null }) {
  const [state, action, pending] = useActionState(overrideAttendance, null);
  // React clears a form after each submit. An error sends back what was typed, and the form is
  // re-created from it (the key), because a dropdown doesn't pick up a changed default on its own.
  const typed = state?.values ?? {};
  return (
    <form key={JSON.stringify(typed)} action={action} className="space-y-1">
      <input type="hidden" name="meetingId" value={meetingId} />
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1">
          <span className="muted block text-xs">Change to<span className="sr-only"> for {name}</span></span>
          <select name="status" defaultValue={typed.status ?? status ?? "present"} className="input w-auto text-sm capitalize">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="min-w-32 flex-1 space-y-1">
          <span className="muted block text-xs">Reason<span className="sr-only"> for changing {name}</span></span>
          <input name="reason" required defaultValue={typed.reason} placeholder="e.g. Phone died" className="input text-sm" />
        </label>
        <button className="btn-ghost" disabled={pending} aria-label={`Save ${name}'s attendance`}>{pending ? "Saving…" : "Save"}</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
