"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { GROUP_KIND_HELP, GROUP_KIND_LABEL, type GroupKind } from "@/lib/types";
import { createGroup } from "../actions";

export function NewGroupForm() {
  const [state, action, pending] = useActionState(createGroup, null);
  return (
    <form action={action} className="card space-y-2">
      <h2 className="font-semibold">New group</h2>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
        <label className="space-y-1">
          <span className="muted block text-xs">Group name</span>
          <input name="name" className="input" placeholder="e.g. Marketing, Core, Leads, Hackathon 2026 team" required maxLength={80} />
        </label>
        <label className="space-y-1">
          <span className="muted block text-xs">Type</span>
          <select name="kind" className="input" defaultValue="team">
            {(Object.keys(GROUP_KIND_LABEL) as GroupKind[]).map((k) => <option key={k} value={k}>{GROUP_KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="muted block text-xs">Ends on (optional)</span>
          <input name="endsOn" type="date" className="input" title="Event teams are archived after this date" />
        </label>
        <button className="btn self-end" disabled={pending}>{pending ? "Creating…" : "Create"}</button>
      </div>
      <ul className="muted space-y-0.5 text-xs">
        {(Object.keys(GROUP_KIND_HELP) as GroupKind[]).map((k) => <li key={k}><strong>{GROUP_KIND_LABEL[k]}:</strong> {GROUP_KIND_HELP[k]}</li>)}
      </ul>
      <FormMessage state={state} />
    </form>
  );
}
