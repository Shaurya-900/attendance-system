"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { importRoster } from "../actions";

export function ImportRosterForm() {
  const [state, action, pending] = useActionState(importRoster, null);
  return (
    <form action={action} className="card space-y-2">
      <h2 className="font-semibold">Import members</h2>
      <p className="muted text-xs">Only people added here can sign in. One per line: <code>email,name,roll_no[,admin]</code>. Roll numbers are 11 digits starting with 2. Existing entries are updated.</p>
      <textarea name="csv" rows={5} className="input font-mono text-xs" placeholder={"asha@snu.edu.in,Asha Rao,24010110104\nlead@snu.edu.in,Core Lead,23010110001,admin"} />
      <button className="btn" disabled={pending}>Import</button>
      <FormMessage state={state} />
    </form>
  );
}
