import type { AttendanceStatus, Semester, StrikeAdjustment } from "./types";

export const STRIKE_POINTS: Record<AttendanceStatus, number> = {
  present: 0,
  late: 0.5, // two lates = one strike
  absent: 1,
  excused: 0,
};
export const WARNING_AT = 2;
export const FLAGGED_AT = 3;

export type StrikeLevel = "ok" | "warning" | "flagged";

export function levelFor(points: number): StrikeLevel {
  if (points >= FLAGGED_AT) return "flagged";
  if (points >= WARNING_AT) return "warning";
  return "ok";
}

/** Status for a QR check-in made at `now`. */
export function statusForCheckIn(startsAt: string, graceMinutes: number, now = Date.now()): "present" | "late" {
  return now > new Date(startsAt).getTime() + graceMinutes * 60_000 ? "late" : "present";
}

/** Calendar date (YYYY-MM-DD) of an instant in the club's timezone. */
export function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function inSemester(iso: string, semester: Semester, timeZone: string): boolean {
  const day = localDate(iso, timeZone);
  return day >= semester.startsOn && day <= semester.endsOn;
}

export function currentSemester(semesters: Semester[], timeZone: string, now = new Date()): Semester | null {
  return semesters.find((s) => inSemester(now.toISOString(), s, timeZone)) ?? null;
}

export interface StrikeSummary {
  points: number;
  absences: number;
  lates: number;
  excused: number;
  adjustments: number;
  level: StrikeLevel;
}

/**
 * Sum strike points for one member. With a semester, only meetings in that semester and
 * adjustments tagged with it count; with `null`, everything counts.
 */
export function computeStrikes(
  records: { status: AttendanceStatus; meetingStartsAt: string }[],
  adjustments: (Pick<StrikeAdjustment, "points" | "semesterId"> & { createdAt?: string })[],
  semester: Semester | null,
  timeZone: string,
): StrikeSummary {
  const inScope = semester ? records.filter((r) => inSemester(r.meetingStartsAt, semester, timeZone)) : records;
  const count = (s: AttendanceStatus) => inScope.filter((r) => r.status === s).length;
  const adj = adjustments
    // Untagged adjustments (made with no semester set, or whose semester was deleted) count by date.
    .filter((a) => !semester || a.semesterId === semester.id || (a.semesterId === null && !!a.createdAt && inSemester(a.createdAt, semester, timeZone)))
    .reduce((sum, a) => sum + a.points, 0);
  const points = Math.max(0, inScope.reduce((sum, r) => sum + STRIKE_POINTS[r.status], 0) + adj);
  return { points, absences: count("absent"), lates: count("late"), excused: count("excused"), adjustments: adj, level: levelFor(points) };
}
