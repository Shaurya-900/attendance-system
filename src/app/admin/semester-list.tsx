"use client";

import { startTransition, useOptimistic } from "react";
import type { Semester } from "@/lib/types";
import { deleteSemester } from "./actions";

/** Deleted rows disappear immediately; the server catches up in the background. */
export function SemesterList({ semesters }: { semesters: Semester[] }) {
  const [shown, removeShown] = useOptimistic(semesters, (list, id: string) => list.filter((s) => s.id !== id));

  function remove(s: Semester) {
    if (!confirm(`Delete semester "${s.name}"? Attendance records are kept.`)) return;
    const form = new FormData();
    form.set("semesterId", s.id);
    form.set("name", s.name);
    startTransition(async () => {
      removeShown(s.id);
      await deleteSemester(form);
    });
  }

  return (
    <ul className="space-y-1 text-sm">
      {shown.map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-2">
          <span>{s.name}: {s.startsOn} to {s.endsOn}</span>
          <button type="button" onClick={() => remove(s)} className="btn-ghost py-0.5 text-xs" aria-label={`Delete semester ${s.name}`}>Delete</button>
        </li>
      ))}
      {shown.length === 0 && <li className="muted">No semesters yet.</li>}
    </ul>
  );
}
