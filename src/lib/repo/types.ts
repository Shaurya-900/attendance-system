import type {
  Attendance, AuditEntry, Excuse, Group, GroupMember, ExcuseStatus, Meeting, MeetingStatus, MemberEdit, MemberEditStatus, Passkey, Profile, RosterEntry,
  RosterGroup, Semester, StrikeAdjustment,
} from "../types";

export type InsertAttendanceResult = "ok" | "duplicate_user" | "duplicate_device";

export interface Repo {
  getProfile(id: string): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  upsertProfile(p: Omit<Profile, "createdAt">): Promise<Profile>;
  setProfileActive(id: string, active: boolean): Promise<void>;

  getRosterEntry(email: string): Promise<RosterEntry | null>;
  listRoster(): Promise<RosterEntry[]>;
  upsertRoster(entries: RosterEntry[]): Promise<void>;
  /** Update one roster entry, renaming it when `entry.email` differs from `oldEmail` (its team places follow). */
  updateRosterEntry(oldEmail: string, entry: RosterEntry): Promise<void>;
  /** Change the email a member signs in with. */
  updateAuthEmail(userId: string, email: string): Promise<void>;

  listRosterGroups(filter?: { email?: string; groupId?: string }): Promise<RosterGroup[]>;
  addRosterGroup(email: string, groupId: string): Promise<void>;
  removeRosterGroup(email: string, groupId: string): Promise<void>;

  listMemberEdits(status?: MemberEditStatus): Promise<MemberEdit[]>;
  getMemberEdit(id: string): Promise<MemberEdit | null>;
  createMemberEdit(input: Pick<MemberEdit, "targetEmail" | "changes" | "requestedBy">): Promise<MemberEdit>;
  setMemberEditStatus(id: string, status: MemberEditStatus, reviewedBy: string): Promise<void>;

  getPasskeyByUser(userId: string): Promise<Passkey | null>;
  listPasskeys(): Promise<Passkey[]>;
  getPasskeysByDevice(deviceId: string): Promise<Passkey[]>;
  insertPasskey(p: Omit<Passkey, "createdAt">): Promise<void>;
  updatePasskeyCounter(credentialId: string, counter: number): Promise<void>;
  deletePasskey(userId: string): Promise<void>;

  listMeetings(): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | null>;
  createMeeting(input: { title: string; startsAt: string; graceMinutes: number; groupId: string | null; createdBy: string }): Promise<Meeting>;
  setMeetingStatus(id: string, status: MeetingStatus): Promise<void>;
  /** Deletes the meeting together with its attendance and excuses. */
  deleteMeeting(id: string): Promise<void>;

  listAttendanceForMeeting(meetingId: string): Promise<Attendance[]>;
  listAttendanceForUser(userId: string): Promise<Attendance[]>;
  listAllAttendance(): Promise<Attendance[]>;
  /** Records for meetings starting in [fromIso, toIso). */
  listAttendanceBetween(fromIso: string, toIso: string): Promise<Attendance[]>;
  getAttendance(meetingId: string, userId: string): Promise<Attendance | null>;
  /** Number of present/late check-ins per meeting id. */
  checkedInCounts(): Promise<Map<string, number>>;
  /** Insert a QR check-in. Never overwrites a present/late record; replaces an absence or excuse (they turned up after all). */
  insertAttendance(a: Attendance): Promise<InsertAttendanceResult>;
  /** Create or replace (admin overrides, meeting close, excuses). */
  upsertAttendance(a: Attendance): Promise<void>;
  /** Insert many records in one go, leaving any that already exist untouched (meeting close, backfill). */
  insertMissingAttendance(rows: Attendance[]): Promise<void>;

  listExcuses(filter?: { userId?: string; meetingId?: string; status?: ExcuseStatus }): Promise<Excuse[]>;
  getExcuse(id: string): Promise<Excuse | null>;
  createExcuse(input: { meetingId: string; userId: string; reason: string }): Promise<Excuse>;
  setExcuseStatus(id: string, status: ExcuseStatus, reviewedBy: string): Promise<void>;

  listSemesters(): Promise<Semester[]>;
  createSemester(input: Omit<Semester, "id">): Promise<Semester>;
  deleteSemester(id: string): Promise<void>;

  listAdjustments(userId?: string): Promise<StrikeAdjustment[]>;
  addAdjustment(input: Omit<StrikeAdjustment, "id" | "createdAt">): Promise<void>;

  listGroups(): Promise<Group[]>;
  getGroup(id: string): Promise<Group | null>;
  createGroup(input: Pick<Group, "name" | "kind" | "endsOn">): Promise<Group>;
  updateGroup(id: string, patch: Partial<Pick<Group, "name" | "endsOn" | "archived">>): Promise<void>;
  listGroupMembers(groupId?: string): Promise<GroupMember[]>;
  listMembershipsForUser(userId: string): Promise<GroupMember[]>;
  setGroupMember(groupId: string, userId: string, role: GroupMember["role"]): Promise<void>;
  removeGroupMember(groupId: string, userId: string): Promise<void>;
  /** Deletes the group together with its meetings and their attendance and excuses. */
  deleteGroup(id: string): Promise<void>;
  /** Deletes a member's login, profile and all their records, and removes them from the members list. */
  deleteMember(userId: string): Promise<void>;
  deleteRosterEntry(email: string): Promise<void>;

  addAudit(input: Omit<AuditEntry, "id" | "createdAt">): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;
}
