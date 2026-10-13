"use client";

import { deleteSemester } from "./actions";

export function DeleteSemesterButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteSemester}
      onSubmit={(e) => {
        if (!confirm(`Delete semester "${name}"? Attendance records are kept.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="semesterId" value={id} />
      <button className="btn-ghost py-0.5 text-xs" aria-label={`Delete semester ${name}`}>Delete</button>
    </form>
  );
}
