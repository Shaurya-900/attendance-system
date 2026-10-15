"use client";

import { useFormStatus } from "react-dom";

function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending}>{pending ? pendingLabel : label}</button>;
}

/** A one-button form that asks for confirmation first, for destructive actions. */
export function ConfirmForm({
  action, fields, confirm: message, label, pendingLabel = "Deleting…", className = "btn-ghost text-xs text-[var(--red)]",
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  confirm: string;
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <SubmitButton label={label} pendingLabel={pendingLabel} className={className} />
    </form>
  );
}
