"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { addExcuseForMember } from "../actions";

export interface ExcuseMeetingOption { id: string; label: string; memberIds: string[] }

export function AddExcuseForm({ meetings, members }: { meetings: ExcuseMeetingOption[]; members: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addExcuseForMember, null);
  const [meetingId, setMeetingId] = useState(meetings[0]?.id ?? "");
  const allowed = new Set(meetings.find((m) => m.id === meetingId)?.memberIds ?? []);
  const options = members.filter((m) => allowed.has(m.id));
  if (meetings.length === 0) return null;
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-semibold">Add an excuse for a member</h2>
      <p className="muted text-xs">For when someone tells you directly. It is approved straight away and the absence stops counting as a strike.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="muted">Meeting</span>
          <select name="meetingId" className="input" value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
            {meetings.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="muted">Member</span>
          <select name="userId" className="input" required>
            {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span className="muted">Reason</span>
        <input name="reason" className="input" required minLength={3} maxLength={500} placeholder="e.g. Medical, exam, family" />
      </label>
      <FormMessage state={state} />
      <button className="btn w-full sm:w-auto" disabled={pending}>{pending ? "Adding…" : "Add excuse"}</button>
    </form>
  );
}
