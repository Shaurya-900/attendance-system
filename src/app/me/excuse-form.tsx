"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { requestExcuse } from "./actions";

export function ExcuseForm({ meetings }: { meetings: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(requestExcuse, null);
  return (
    <form action={action} className="card space-y-2">
      <h2 className="font-semibold">Request an excuse</h2>
      <select name="meetingId" className="input" required>
        {meetings.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
      <textarea name="reason" className="input" required minLength={5} maxLength={500} placeholder="Reason (e.g. exam, medical)" />
      <FormMessage state={state} />
      <button className="btn" disabled={pending}>{pending ? "Sending…" : "Submit"}</button>
    </form>
  );
}
