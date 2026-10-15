export function FormMessage({ state }: { state: { error?: string; ok?: string } | null }) {
  if (state?.error) return <p role="alert" className="alert alert-error whitespace-pre-line">{state.error}</p>;
  if (state?.ok) return <p role="status" className="alert alert-ok">{state.ok}</p>;
  return null;
}
