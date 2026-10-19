import { Bar } from "@/components/skeleton";

/** Shaped like the page: heading, a disclosure, the search bar, then one line per member. */
export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading members">
      <div className="space-y-2"><Bar className="h-8 w-40" /><Bar className="h-4 w-64" /></div>
      <div className="card"><Bar className="h-5 w-56" /></div>
      <div className="flex gap-2"><Bar className="h-10 flex-1" /><Bar className="h-10 w-24" /></div>
      <ul className="card member-list">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex items-center justify-between gap-4 px-4 py-4"><Bar className="h-4 w-1/3" /><Bar className="h-3 w-24" /></li>
        ))}
      </ul>
    </div>
  );
}
