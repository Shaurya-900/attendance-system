"use client";

import { useRef } from "react";
import { createMeeting } from "../actions";

export function NewMeetingForm({ audiences }: { audiences: { id: string; label: string }[] }) {
  const hidden = useRef<HTMLInputElement>(null);
  return (
    <form
      action={createMeeting}
      onSubmit={(e) => {
        const local = (e.currentTarget.elements.namedItem("local") as HTMLInputElement).value;
        hidden.current!.value = new Date(local).toISOString();
      }}
      className="card grid gap-2 sm:grid-cols-[2fr_1.5fr_1.5fr_1fr_auto]"
    >
      <input name="title" className="input" placeholder="Meeting title" required maxLength={120} />
      <select name="groupId" className="input" aria-label="For">
        {audiences.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </select>
      <input name="local" type="datetime-local" className="input" required aria-label="Starts at" />
      <input name="graceMinutes" type="number" min={0} max={120} defaultValue={10} className="input" aria-label="Grace minutes" title="Minutes after start before check-ins count as late" />
      <input ref={hidden} type="hidden" name="startsAt" />
      <button className="btn">Create</button>
    </form>
  );
}
