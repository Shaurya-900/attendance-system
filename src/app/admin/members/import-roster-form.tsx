"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { importRoster } from "../actions";

export function ImportRosterForm() {
  const [state, action, pending] = useActionState(importRoster, null);
  return (
    <form action={action} className="space-y-2">
      <p className="muted text-xs">Only people added here can sign in. Paste rows from Excel as <code>name, roll no, SNU mail ID</code> (e.g. ab123@snu.edu.in), adding <code>admin</code> as a fourth column for admins. Names can&apos;t contain numbers; roll numbers are 10 digits starting with 2. Existing entries are updated.</p>
      <label htmlFor="roster-rows" className="block text-sm font-semibold">Rows from Excel</label>
      <textarea id="roster-rows" name="csv" rows={5} className="input font-mono text-xs" placeholder={"Asha Rao\t2610110014\tasha@snu.edu.in\nCore Lead\t2310110600\tlead@snu.edu.in\tadmin"} />
      <button className="btn" disabled={pending}>{pending ? "Importing…" : "Import"}</button>
      <FormMessage state={state} />
    </form>
  );
}
