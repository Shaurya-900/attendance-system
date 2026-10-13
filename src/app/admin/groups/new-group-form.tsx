"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { createGroup } from "../actions";

export function NewGroupForm() {
  const [state, action, pending] = useActionState(createGroup, null);
  return (
    <form action={action} className="card space-y-2">
      <h2 className="font-semibold">New group</h2>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <input name="name" className="input" placeholder="e.g. Leads, Marketing, Core committee, TEDx 2026 team" required maxLength={80} />
        <select name="kind" className="input" aria-label="Type" defaultValue="team">
          <option value="team">Team / vertical</option>
          <option value="committee">Committee (core / sub-core)</option>
          <option value="leads">Leads</option>
          <option value="event">Event team</option>
        </select>
        <input name="endsOn" type="date" className="input" aria-label="Ends on (optional)" title="Optional — event teams are archived after this date" />
        <button className="btn" disabled={pending}>Create</button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
