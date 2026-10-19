"use client";

import { useActionState, useEffect, useState } from "react";
import { FormMessage } from "@/components/form-message";
import { addGroupMembers } from "../../actions";

type Candidate = { name: string; rollNo: string | null };

export function AddMembersForm({ groupId, candidates, notJoined }: {
  groupId: string;
  candidates: (Candidate & { id: string })[];
  /** On the roster but not signed in yet; they join on first sign-in. */
  notJoined: (Candidate & { email: string })[];
}) {
  const [state, action, pending] = useActionState(addGroupMembers, null);
  const [filter, setFilter] = useState("");
  // Ticked people, kept even while the search hides them, so they're still added.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [state]); // start fresh after each add

  const match = (c: Candidate) => `${c.name} ${c.rollNo ?? ""}`.toLowerCase().includes(filter.toLowerCase());
  const rows = [
    ...candidates.map((c) => ({ key: `userId:${c.id}`, name: "userId", value: c.id, c, note: "" })),
    ...notJoined.map((c) => ({ key: `email:${c.email}`, name: "email", value: c.email, c, note: " · not signed in yet" })),
  ];
  const shown = rows.filter((r) => match(r.c));
  const toggle = (key: string, on: boolean) => setSelected((s) => {
    const next = new Set(s);
    if (on) next.add(key); else next.delete(key);
    return next;
  });

  return (
    <form action={action} className="card space-y-2">
      <h2 className="font-semibold">Add members</h2>
      <input type="hidden" name="groupId" value={groupId} />
      {rows.length > 0 && (
        <>
          <input className="input" placeholder="Search by name or roll no." value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button type="button" className="btn-ghost text-xs" disabled={shown.length === 0}
              onClick={() => setSelected((s) => new Set([...s, ...shown.map((r) => r.key)]))}>
              {filter ? `Select all ${shown.length} shown` : "Select all"}
            </button>
            <button type="button" className="btn-ghost text-xs" disabled={selected.size === 0} onClick={() => setSelected(new Set())}>Clear</button>
            <span className="muted" aria-live="polite">{selected.size} of {rows.length} selected</span>
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {rows.map((r) => (
              <label key={r.key} hidden={!match(r.c)} className="flex min-h-9 items-center gap-2 pointer-coarse:min-h-11">
                <input type="checkbox" name={r.name} value={r.value} className="size-5"
                  checked={selected.has(r.key)} onChange={(e) => toggle(r.key, e.target.checked)} />
                {r.c.name} <span className="muted text-xs">{r.c.rollNo}{r.note}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="muted">Nobody matches.</p>}
          </div>
        </>
      )}
      <textarea name="emails" rows={2} className="input text-xs" placeholder="…or paste SNU mail IDs (one per line or comma-separated)" />
      <FormMessage state={state} />
      <button className="btn" disabled={pending}>{pending ? "Adding…" : selected.size ? `Add ${selected.size} to group` : "Add to group"}</button>
    </form>
  );
}
