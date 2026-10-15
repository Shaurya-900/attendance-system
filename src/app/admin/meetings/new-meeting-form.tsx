"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/form-message";
import { createMeeting } from "../actions";

function CreateButton() {
  const { pending } = useFormStatus();
  return <button className="btn w-full sm:w-auto" disabled={pending}>{pending ? "Creating…" : "Create"}</button>;
}

export function NewMeetingForm({ audiences }: { audiences: { id: string; label: string }[] }) {
  const hidden = useRef<HTMLInputElement>(null);
  const [state, action] = useActionState(createMeeting, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const local = (e.currentTarget.elements.namedItem("local") as HTMLInputElement).value;
        hidden.current!.value = new Date(local).toISOString();
      }}
      className="card space-y-3"
    >
      <h2 className="font-semibold">New meeting</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="muted">Title</span>
          <input name="title" className="input" placeholder="Meeting title" required maxLength={120} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">For</span>
          <select name="groupId" className="input">
            {audiences.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">Starts at</span>
          <input name="local" type="datetime-local" className="input" required />
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">Mark late after (minutes)</span>
          <input name="graceMinutes" type="number" min={0} max={120} defaultValue={10} className="input" />
        </label>
      </div>
      <p className="muted text-xs">Check-ins more than this many minutes after the start are marked late. Late is shown in the records but is not a strike.</p>
      <input ref={hidden} type="hidden" name="startsAt" />
      <CreateButton />
      <FormMessage state={state} />
    </form>
  );
}
