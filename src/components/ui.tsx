import type { StrikeLevel } from "@/lib/strikes";
import { FLAGGED_AT } from "@/lib/strikes";
import type { AttendanceStatus } from "@/lib/types";

/** Status is written in its ink, like a mark in the register: no pill or wash behind it. */
const levelStyle: Record<StrikeLevel, string> = {
  ok: "text-[var(--accent)]",
  warning: "text-[var(--pencil)]",
  flagged: "text-[var(--red)]",
};

/** Three punched holes, filled in red per strike point (half points fill half a hole). */
export function StrikeHoles({ points, size = "0.625rem" }: { points: number; size?: string }) {
  return (
    <span className="holes" role="img" aria-label={`${points} of ${FLAGGED_AT} strikes`} style={{ "--size": size, "--gap": `calc(${size} / 2.5)` } as React.CSSProperties}>
      {Array.from({ length: FLAGGED_AT }, (_, i) => {
        const fill = Math.min(Math.max(points - i, 0), 1);
        return <span key={i} className="hole" data-full={fill === 1 || undefined} style={{ "--fill": `${fill * 100}%` } as React.CSSProperties} />;
      })}
    </span>
  );
}

export function LevelBadge({ level, points }: { level: StrikeLevel; points: number }) {
  const label = level === "ok" ? "Good standing" : level === "warning" ? "Warning" : "Flagged";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${levelStyle[level]}`}>
      <StrikeHoles points={points} size="0.5rem" /> {points} pts, {label.toLowerCase()}
    </span>
  );
}

const statusStyle: Record<AttendanceStatus, string> = {
  present: levelStyle.ok,
  late: levelStyle.warning,
  absent: levelStyle.flagged,
  excused: "text-[var(--muted)]",
};

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return <span className={`text-xs font-semibold capitalize ${statusStyle[status]}`}>{status}</span>;
}

export function Flags({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return <span className="ml-1 text-xs font-semibold text-[var(--red)]">{flags.join(", ").replace(/_/g, " ")}</span>;
}

export function fmt(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "Asia/Kolkata" });
}

export function GroupBadge({ name }: { name: string | null | undefined }) {
  return (
    <span className="whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium" style={{ borderColor: "var(--border)" }}>
      {name ?? "Full body"}
    </span>
  );
}
