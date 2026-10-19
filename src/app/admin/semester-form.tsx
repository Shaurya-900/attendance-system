"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { createSemester } from "./actions";

export function SemesterForm() {
  const [state, action, pending] = useActionState(createSemester, null);
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="space-y-1">
          <span className="muted block text-xs">Semester name</span>
          <input name="name" className="input" placeholder="e.g. Odd sem 2026" required />
        </label>
        <label className="space-y-1">
          <span className="muted block text-xs">Starts on</span>
          <input name="startsOn" type="date" className="input" required />
        </label>
        <label className="space-y-1">
          <span className="muted block text-xs">Ends on</span>
          <input name="endsOn" type="date" className="input" required />
        </label>
        <button className="btn self-end" disabled={pending}>{pending ? "Adding…" : "Add semester"}</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
