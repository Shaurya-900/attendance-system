import type { StrikeLevel } from "@/lib/strikes";
import type { AttendanceStatus } from "@/lib/types";

const levelStyle: Record<StrikeLevel, string> = {
  ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  flagged: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export function LevelBadge({ level, points }: { level: StrikeLevel; points: number }) {
  const label = level === "ok" ? "Good standing" : level === "warning" ? "Warning" : "Flagged";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${levelStyle[level]}`}>{points} pts · {label}</span>;
}

const statusStyle: Record<AttendanceStatus, string> = {
  present: levelStyle.ok,
  late: levelStyle.warning,
  absent: levelStyle.flagged,
  excused: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusStyle[status]}`}>{status}</span>;
}

export function Flags({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return <span className="ml-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">{flags.join(", ").replace(/_/g, " ")}</span>;
}

export function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" });
}
