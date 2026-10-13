import { env } from "./env";
import type { Repo } from "./repo/types";
import { computeStrikes, currentSemester, localDate, type StrikeSummary } from "./strikes";
import type { Attendance, Group, GroupMember, Meeting, Profile, Semester, StrikeAdjustment } from "./types";

/** Members can ask for an excuse until 24h after a meeting starts. */
export const EXCUSE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** An event team stops being active the day after its end date; any group can be archived by hand. */
export function isGroupActive(group: Group, now = new Date()): boolean {
  return !group.archived && (!group.endsOn || group.endsOn >= localDate(now.toISOString(), env.timezone));
}

/** Who is expected at a meeting: all active members for full body, otherwise the group's active members (leads included). */
export async function expectedMembers(repo: Repo, meeting: Pick<Meeting, "groupId">): Promise<Profile[]> {
  const profiles = await repo.listProfiles();
  if (!meeting.groupId) return profiles.filter((p) => p.active && p.role === "member");
  const ids = new Set((await repo.listGroupMembers(meeting.groupId)).map((m) => m.userId));
  return profiles.filter((p) => p.active && ids.has(p.id));
}

/** Close a meeting: every expected member without a record becomes absent, or excused if an excuse was approved. */
export async function closeMeeting(repo: Repo, meetingId: string, actorId: string) {
  const meeting = await repo.getMeeting(meetingId);
  if (!meeting) return;
  // Close first so no check-in can land while absentees are written. Safe to re-run:
  // only members with no record yet are touched, so a failed close can simply be retried.
  if (meeting.status !== "closed") await repo.setMeetingStatus(meetingId, "closed");
  const [profiles, records, excuses] = await Promise.all([
    expectedMembers(repo, meeting),
    repo.listAttendanceForMeeting(meetingId),
    repo.listExcuses({ status: "approved" }),
  ]);
  const attended = new Set(records.map((r) => r.userId));
  const excused = new Set(excuses.filter((e) => e.meetingId === meetingId).map((e) => e.userId));
  let absent = 0;
  for (const p of profiles) {
    if (attended.has(p.id)) continue;
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
    // Group membership is set by admins after sign-up, so only full-body meetings are backfilled.
    if (m.groupId || m.status !== "closed" || Date.parse(m.startsAt) < since || has.has(m.id)) continue;
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

function withStart(records: Attendance[], meetings: Map<string, Meeting>) {
  return records.flatMap((r) => {
    const m = meetings.get(r.meetingId);
    return m ? [{ status: r.status, meetingStartsAt: m.startsAt }] : [];
  });
}

export interface ScopeStanding {
  /** null = full body */
  group: Group | null;
  summary: StrikeSummary;
}

export const scopeLabel = (s: ScopeStanding) => s.group?.name ?? "Full body";

/** The scope with the most strike points — what admins should look at first. */
export function worstScope(scopes: ScopeStanding[]): ScopeStanding {
  return scopes.reduce((a, b) => (b.summary.points > a.summary.points ? b : a));
}

interface StandingData {
  meetings: Meeting[];
  attendance: Attendance[];
  adjustments: StrikeAdjustment[];
  semesters: Semester[];
  groups: Group[];
  memberships: GroupMember[];
}

function scopesFor(userId: string, d: StandingData, semester: Semester | null): ScopeStanding[] {
  const byMeeting = new Map(d.meetings.map((m) => [m.id, m]));
  const groupById = new Map(d.groups.map((g) => [g.id, g]));
  const summarize = (groupId: string | null) => computeStrikes(
    withStart(d.attendance.filter((a) => a.userId === userId && (byMeeting.get(a.meetingId)?.groupId ?? null) === groupId), byMeeting),
    d.adjustments.filter((a) => a.userId === userId && (a.groupId ?? null) === groupId),
    semester,
    env.timezone,
  );
  const scopes: ScopeStanding[] = [{ group: null, summary: summarize(null) }];
  for (const m of d.memberships.filter((x) => x.userId === userId)) {
    const group = groupById.get(m.groupId);
    if (group) scopes.push({ group, summary: summarize(group.id) });
  }
  return scopes;
}

/**
 * Strike standings in the current semester (or all time when none is configured).
 * Full body and every group keep separate counts; `byUser` maps each profile to the full-body
 * scope first, followed by one scope per group they belong to.
 */
export async function standings(repo: Repo): Promise<{ semester: Semester | null; byUser: Map<string, ScopeStanding[]> }> {
  const [meetings, attendance, adjustments, semesters, profiles, groups, memberships] = await Promise.all([
    repo.listMeetings(), repo.listAllAttendance(), repo.listAdjustments(), repo.listSemesters(), repo.listProfiles(),
    repo.listGroups(), repo.listGroupMembers(),
  ]);
  const data = { meetings, attendance, adjustments, semesters, groups, memberships };
  const semester = currentSemester(semesters, env.timezone);
  return { semester, byUser: new Map(profiles.map((p) => [p.id, scopesFor(p.id, data, semester)])) };
}

/** Same as `standings`, but only loads one member's records — used on their own page. */
export async function standingsForUser(repo: Repo, userId: string): Promise<{ semester: Semester | null; scopes: ScopeStanding[]; meetings: Meeting[]; attendance: Attendance[]; groups: Group[]; memberships: GroupMember[] }> {
  const [meetings, attendance, adjustments, semesters, groups, memberships] = await Promise.all([
    repo.listMeetings(), repo.listAttendanceForUser(userId), repo.listAdjustments(userId), repo.listSemesters(),
    repo.listGroups(), repo.listGroupMembers(),
  ]);
  const mine = memberships.filter((m) => m.userId === userId);
  const semester = currentSemester(semesters, env.timezone);
  const scopes = scopesFor(userId, { meetings, attendance, adjustments, semesters, groups, memberships: mine }, semester);
  return { semester, scopes, meetings, attendance, groups, memberships: mine };
}
