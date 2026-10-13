"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { createSemester } from "./actions";

export function SemesterForm() {
  const [state, action, pending] = useActionState(createSemester, null);
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-4">
        <input name="name" className="input" placeholder="e.g. Odd sem 2026" required />
        <input name="startsOn" type="date" className="input" required aria-label="Starts on" />
        <input name="endsOn" type="date" className="input" required aria-label="Ends on" />
        <button className="btn" disabled={pending}>{pending ? "Adding…" : "Add semester"}</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
