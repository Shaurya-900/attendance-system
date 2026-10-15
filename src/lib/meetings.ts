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
export function expectedFrom(profiles: Profile[], groupMembers: GroupMember[], meeting: Pick<Meeting, "groupId">): Profile[] {
  if (!meeting.groupId) return profiles.filter((p) => p.active && p.role === "member");
  const ids = new Set(groupMembers.filter((m) => m.groupId === meeting.groupId).map((m) => m.userId));
  return profiles.filter((p) => p.active && ids.has(p.id));
}

export async function expectedMembers(repo: Repo, meeting: Pick<Meeting, "groupId">): Promise<Profile[]> {
  const [profiles, members] = await Promise.all([repo.listProfiles(), meeting.groupId ? repo.listGroupMembers(meeting.groupId) : []]);
  return expectedFrom(profiles, members, meeting);
}

function blankRecord(meetingId: string, userId: string, status: "absent" | "excused"): Attendance {
  return { meetingId, userId, status, checkedInAt: null, credentialId: null, deviceId: null, source: "manual", flags: [] };
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
    repo.listExcuses({ meetingId, status: "approved" }),
  ]);
  const attended = new Set(records.map((r) => r.userId));
  const excused = new Set(excuses.map((e) => e.userId));
  // One batched write. Existing records are never overwritten, so a check-in that lands
  // while the meeting is closing still counts.
  const rows = profiles.filter((p) => !attended.has(p.id)).map((p) => blankRecord(meetingId, p.id, excused.has(p.id) ? "excused" : "absent"));
  await repo.insertMissingAttendance(rows);
  const absent = rows.filter((r) => r.status === "absent").length;
  await repo.addAudit({ actorId, action: "meeting.close", target: meetingId, details: { present: records.length, absent } });
}

/**
 * A roster member who signs in for the first time gets "absent" for every meeting closed since
 * they were added to the roster. Otherwise never signing in would dodge the 3-strike rule.
 */
export async function backfillAbsences(repo: Repo, userId: string, rosterAddedAt: string) {
  const [meetings, records, excuses] = await Promise.all([
    repo.listMeetings(), repo.listAttendanceForUser(userId), repo.listExcuses({ userId, status: "approved" }),
  ]);
  const has = new Set(records.map((r) => r.meetingId));
  const excused = new Set(excuses.map((e) => e.meetingId));
  const since = Date.parse(rosterAddedAt);
  // Group membership is set by admins after sign-up, so only full-body meetings are backfilled.
  const rows = meetings
    .filter((m) => !m.groupId && m.status === "closed" && Date.parse(m.startsAt) >= since && !has.has(m.id))
    .map((m) => blankRecord(m.id, userId, excused.has(m.id) ? "excused" : "absent"));
  await repo.insertMissingAttendance(rows);
  const count = rows.length;
  if (count > 0) await repo.addAudit({ actorId: null, action: "attendance.backfill", target: userId, details: { meetings: count } });
}

/** Approving an excuse after the meeting closed turns the recorded absence into "excused". */
export async function applyApprovedExcuse(repo: Repo, meetingId: string, userId: string) {
  const record = await repo.getAttendance(meetingId, userId);
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

/** The scope with the most strike points: what admins should look at first. */
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

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const t of items) {
    const k = key(t);
    const list = out.get(k);
    if (list) list.push(t); else out.set(k, [t]);
  }
  return out;
}

/** `d` holds one member's attendance, adjustments and memberships (or more; they are filtered by userId). */
function scopesFor(userId: string, d: StandingData, semester: Semester | null, byMeeting: Map<string, Meeting>, groupById: Map<string, Group>): ScopeStanding[] {
  const attendance = d.attendance.filter((a) => a.userId === userId);
  const adjustments = d.adjustments.filter((a) => a.userId === userId);
  const summarize = (groupId: string | null) => computeStrikes(
    withStart(attendance.filter((a) => (byMeeting.get(a.meetingId)?.groupId ?? null) === groupId), byMeeting),
    adjustments.filter((a) => (a.groupId ?? null) === groupId),
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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * UTC instants that safely cover a semester's local dates in any timezone (a day of slack on
 * each side). computeStrikes still applies the exact local-date check.
 */
export function semesterRange(s: Semester): [string, string] {
  const from = Date.parse(`${s.startsOn}T00:00:00Z`) - DAY_MS;
  const to = Date.parse(`${s.endsOn}T00:00:00Z`) + 2 * DAY_MS;
  return [new Date(from).toISOString(), new Date(to).toISOString()];
}

/**
 * Strike standings in the current semester (or all time when none is configured).
 * Full body and every group keep separate counts; `byUser` maps each profile to the full-body
 * scope first, followed by one scope per group they belong to.
 */
export async function standings(repo: Repo): Promise<{ semester: Semester | null; byUser: Map<string, ScopeStanding[]> }> {
  const semestersP = repo.listSemesters();
  // Only the current semester's records count, so don't load older ones.
  const attendanceP = semestersP.then((all) => {
    const s = currentSemester(all, env.timezone);
    return s ? repo.listAttendanceBetween(...semesterRange(s)) : repo.listAllAttendance();
  });
  const [meetings, attendance, adjustments, semesters, profiles, groups, memberships] = await Promise.all([
    repo.listMeetings(), attendanceP, repo.listAdjustments(), semestersP, repo.listProfiles(),
    repo.listGroups(), repo.listGroupMembers(),
  ]);
  const semester = currentSemester(semesters, env.timezone);
  const byMeeting = new Map(meetings.map((m) => [m.id, m]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  // Split the records by member once, instead of scanning every record for every member.
  const att = groupBy(attendance, (a) => a.userId);
  const adj = groupBy(adjustments, (a) => a.userId);
  const mem = groupBy(memberships, (m) => m.userId);
  return {
    semester,
    byUser: new Map(profiles.map((p) => [p.id, scopesFor(p.id, {
      meetings, semesters, groups, attendance: att.get(p.id) ?? [], adjustments: adj.get(p.id) ?? [], memberships: mem.get(p.id) ?? [],
    }, semester, byMeeting, groupById)])),
  };
}

/** Same as `standings`, but only loads one member's records. Used on their own page. */
export async function standingsForUser(repo: Repo, userId: string): Promise<{ semester: Semester | null; scopes: ScopeStanding[]; meetings: Meeting[]; attendance: Attendance[]; groups: Group[]; memberships: GroupMember[] }> {
  const [meetings, attendance, adjustments, semesters, groups, mine] = await Promise.all([
    repo.listMeetings(), repo.listAttendanceForUser(userId), repo.listAdjustments(userId), repo.listSemesters(),
    repo.listGroups(), repo.listMembershipsForUser(userId),
  ]);
  const semester = currentSemester(semesters, env.timezone);
  const scopes = scopesFor(userId, { meetings, attendance, adjustments, semesters, groups, memberships: mine }, semester,
    new Map(meetings.map((m) => [m.id, m])), new Map(groups.map((g) => [g.id, g])));
  return { semester, scopes, meetings, attendance, groups, memberships: mine };
}
