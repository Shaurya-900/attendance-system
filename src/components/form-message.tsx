export function FormMessage({ state }: { state: { error?: string; ok?: string } | null }) {
  if (state?.error) return <p role="alert" className="rounded-lg bg-red-100 p-2 text-sm text-red-800">{state.error}</p>;
  if (state?.ok) return <p role="status" className="rounded-lg bg-emerald-100 p-2 text-sm text-emerald-800">{state.ok}</p>;
  return null;
}
