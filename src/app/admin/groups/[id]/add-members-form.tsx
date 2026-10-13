"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { addGroupMembers } from "../../actions";

export function AddMembersForm({ groupId, candidates }: { groupId: string; candidates: { id: string; name: string; rollNo: string | null }[] }) {
  const [state, action, pending] = useActionState(addGroupMembers, null);
  const [filter, setFilter] = useState("");
  const shown = candidates.filter((c) => `${c.name} ${c.rollNo ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <form action={action} className="card space-y-2">
      <h2 className="font-semibold">Add members</h2>
      <input type="hidden" name="groupId" value={groupId} />
      {candidates.length > 0 && (
        <>
          <input className="input" placeholder="Search by name or roll no." value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {shown.map((c) => (
              <label key={c.id} className="flex min-h-9 items-center gap-2">
                <input type="checkbox" name="userId" value={c.id} className="size-5" /> {c.name} <span className="muted text-xs">{c.rollNo}</span>
              </label>
            ))}
          </div>
        </>
      )}
      <textarea name="emails" rows={2} className="input text-xs" placeholder="…or paste emails (one per line or comma-separated)" />
      <FormMessage state={state} />
      <button className="btn" disabled={pending}>{pending ? "Adding…" : "Add to group"}</button>
    </form>
  );
}
