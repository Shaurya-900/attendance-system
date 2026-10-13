import { env } from "./env";
import type { Repo } from "./repo/types";
import { computeStrikes, currentSemester, type StrikeSummary } from "./strikes";
import type { Attendance, Meeting, Semester } from "./types";

/** Members can ask for an excuse until 24h after a meeting starts. */
export const EXCUSE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Close a meeting: every active member without a record becomes absent, or excused if an excuse was approved. */
export async function closeMeeting(repo: Repo, meetingId: string, actorId: string) {
  const meeting = await repo.getMeeting(meetingId);
  if (!meeting) return;
  // Close first so no check-in can land while absentees are written. Safe to re-run:
  // only members with no record yet are touched, so a failed close can simply be retried.
  if (meeting.status !== "closed") await repo.setMeetingStatus(meetingId, "closed");
  const [profiles, records, excuses] = await Promise.all([
    repo.listProfiles(),
    repo.listAttendanceForMeeting(meetingId),
    repo.listExcuses({ status: "approved" }),
  ]);
  const attended = new Set(records.map((r) => r.userId));
  const excused = new Set(excuses.filter((e) => e.meetingId === meetingId).map((e) => e.userId));
  let absent = 0;
  for (const p of profiles) {
    if (!p.active || p.role !== "member" || attended.has(p.id)) continue;
    const status = excused.has(p.id) ? "excused" : "absent";
    if (status === "absent") absent++;
    await repo.upsertAttendance({ meetingId, userId: p.id, status, checkedInAt: null, credentialId: null, deviceId: null, source: "manual", flags: [] });
  }
  await repo.addAudit({ actorId, action: "meeting.close", target: meetingId, details: { present: records.length, absent } });
}

/**
 * A roster member who signs in for the first time gets "absent" for every meeting closed since
 * they were added to the roster — otherwise never signing in would dodge the 3-strike rule.
 */
export async function backfillAbsences(repo: Repo, userId: string, rosterAddedAt: string) {
  const [meetings, records, excuses] = await Promise.all([
    repo.listMeetings(), repo.listAttendanceForUser(userId), repo.listExcuses({ userId, status: "approved" }),
  ]);
  const has = new Set(records.map((r) => r.meetingId));
  const excused = new Set(excuses.map((e) => e.meetingId));
  const since = Date.parse(rosterAddedAt);
  let count = 0;
  for (const m of meetings) {
    if (m.status !== "closed" || Date.parse(m.startsAt) < since || has.has(m.id)) continue;
    const status = excused.has(m.id) ? "excused" : "absent";
    await repo.upsertAttendance({ meetingId: m.id, userId, status, checkedInAt: null, credentialId: null, deviceId: null, source: "manual", flags: [] });
    count++;
  }
  if (count > 0) await repo.addAudit({ actorId: null, action: "attendance.backfill", target: userId, details: { meetings: count } });
}

/** Approving an excuse after the meeting closed turns the recorded absence into "excused". */
export async function applyApprovedExcuse(repo: Repo, meetingId: string, userId: string) {
  const record = (await repo.listAttendanceForMeeting(meetingId)).find((a) => a.userId === userId);
  if (record?.status === "absent") await repo.upsertAttendance({ ...record, status: "excused" });
}

export interface MemberStanding {
  semester: Semester | null;
  summary: StrikeSummary;
}

function withStart(records: Attendance[], meetings: Map<string, Meeting>) {
  return records.flatMap((r) => {
    const m = meetings.get(r.meetingId);
    return m ? [{ status: r.status, meetingStartsAt: m.startsAt }] : [];
  });
}

/** Strike standing for every profile in the current semester (or all time when none is configured). */
export async function standings(repo: Repo): Promise<{ semester: Semester | null; byUser: Map<string, StrikeSummary> }> {
  const [meetings, attendance, adjustments, semesters, profiles] = await Promise.all([
    repo.listMeetings(), repo.listAllAttendance(), repo.listAdjustments(), repo.listSemesters(), repo.listProfiles(),
  ]);
  const semester = currentSemester(semesters, env.timezone);
  const byMeeting = new Map(meetings.map((m) => [m.id, m]));
  const byUser = new Map<string, StrikeSummary>();
  for (const p of profiles) {
    byUser.set(p.id, computeStrikes(
      withStart(attendance.filter((a) => a.userId === p.id), byMeeting),
      adjustments.filter((a) => a.userId === p.id),
      semester,
      env.timezone,
    ));
  }
  return { semester, byUser };
}
