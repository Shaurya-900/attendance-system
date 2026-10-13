import type {
  Attendance, AuditEntry, Excuse, ExcuseStatus, Meeting, MeetingStatus, Passkey, Profile, RosterEntry, Semester, StrikeAdjustment,
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

  getPasskeyByUser(userId: string): Promise<Passkey | null>;
  listPasskeys(): Promise<Passkey[]>;
  getPasskeysByDevice(deviceId: string): Promise<Passkey[]>;
  insertPasskey(p: Omit<Passkey, "createdAt">): Promise<void>;
  updatePasskeyCounter(credentialId: string, counter: number): Promise<void>;
  deletePasskey(userId: string): Promise<void>;

  listMeetings(): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | null>;
  createMeeting(input: { title: string; startsAt: string; graceMinutes: number; createdBy: string }): Promise<Meeting>;
  setMeetingStatus(id: string, status: MeetingStatus): Promise<void>;

  listAttendanceForMeeting(meetingId: string): Promise<Attendance[]>;
  listAttendanceForUser(userId: string): Promise<Attendance[]>;
  listAllAttendance(): Promise<Attendance[]>;
  /** Insert a QR check-in; never overwrites. */
  insertAttendance(a: Attendance): Promise<InsertAttendanceResult>;
  /** Create or replace (admin overrides, meeting close, excuses). */
  upsertAttendance(a: Attendance): Promise<void>;

  listExcuses(filter?: { userId?: string; status?: ExcuseStatus }): Promise<Excuse[]>;
  getExcuse(id: string): Promise<Excuse | null>;
  createExcuse(input: { meetingId: string; userId: string; reason: string }): Promise<Excuse>;
  setExcuseStatus(id: string, status: ExcuseStatus, reviewedBy: string): Promise<void>;

  listSemesters(): Promise<Semester[]>;
  createSemester(input: Omit<Semester, "id">): Promise<Semester>;

  listAdjustments(userId?: string): Promise<StrikeAdjustment[]>;
  addAdjustment(input: Omit<StrikeAdjustment, "id" | "createdAt">): Promise<void>;

  addAudit(input: Omit<AuditEntry, "id" | "createdAt">): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;
}
