"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { importGroups } from "../actions";

export function ImportGroupsForm() {
  const [state, action, pending] = useActionState(importGroups, null);
  return (
    <form action={action} className="card space-y-2">
      <h2 className="font-semibold">Make many teams at once</h2>
      <p className="muted text-xs">
        Paste from Excel or Google Sheets, one person per line: <code>team name</code>, then their SNU mail ID or roll number.
        Add <code>lead</code> as a third column to make someone the team&apos;s lead. Teams that don&apos;t exist yet are made for you;
        ones that do just get the new people.
      </p>
      <label htmlFor="group-sheet" className="sr-only">Teams and people</label>
      <textarea id="group-sheet" name="sheet" rows={6} className="input font-mono text-xs" defaultValue={state?.values?.sheet}
        placeholder={"Marketing\tasha@snu.edu.in\tlead\nMarketing\travi@snu.edu.in\nSponsorship\t2610110015"} />
      <FormMessage state={state} />
      <button className="btn" disabled={pending}>{pending ? "Making teams…" : "Make teams"}</button>
    </form>
  );
}
