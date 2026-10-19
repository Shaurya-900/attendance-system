"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { importRoster } from "../actions";

export function ImportRosterForm() {
  const [state, action, pending] = useActionState(importRoster, null);
  return (
    <form action={action} className="card space-y-2">
      <h2 className="font-semibold">Import members</h2>
      <p className="muted text-xs">Only people added here can sign in. Paste rows from Excel as <code>name, roll no, SNU ID</code>, adding <code>admin</code> as a fourth column for admins. Roll numbers are 11 digits starting with 2. Existing entries are updated.</p>
      <textarea name="csv" rows={5} className="input font-mono text-xs" placeholder={"Asha Rao\t24010110104\tasha@snu.edu.in\nCore Lead\t23010110001\tlead@snu.edu.in\tadmin"} />
      <button className="btn" disabled={pending}>Import</button>
      <FormMessage state={state} />
    </form>
  );
}
