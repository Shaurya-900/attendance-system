export type Role = "member" | "admin";

export interface Profile {
  id: string;
  email: string;
  name: string;
  rollNo: string | null;
  role: Role;
  active: boolean;
  createdAt: string;
}

export interface RosterEntry {
  email: string;
  name: string;
  rollNo: string | null;
  role: Role;
  /** When the person was first added to the roster; set by the database. */
  addedAt?: string;
}

export interface Passkey {
  userId: string;
  credentialId: string;
  publicKey: string; // base64url
  counter: number;
  transports: string[];
  deviceId: string;
  createdAt: string;
}

export type MeetingStatus = "scheduled" | "live" | "closed";

export interface Meeting {
  id: string;
  title: string;
  startsAt: string;
  graceMinutes: number;
  status: MeetingStatus;
  qrSecret: string;
  /** null = full-body meeting; otherwise only this group's members are expected. */
  groupId: string | null;
  createdBy: string | null;
  createdAt: string;
}

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export interface Attendance {
  meetingId: string;
  userId: string;
  status: AttendanceStatus;
  checkedInAt: string | null;
  credentialId: string | null;
  deviceId: string | null;
  source: "qr" | "manual";
  /** Suspicious signals for admins to review, e.g. "device_mismatch". */
  flags: string[];
}

export type ExcuseStatus = "pending" | "approved" | "rejected";

export interface Excuse {
  id: string;
  meetingId: string;
  userId: string;
  reason: string;
  status: ExcuseStatus;
  reviewedBy: string | null;
  createdAt: string;
}

export interface Semester {
  id: string;
  name: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: string; // YYYY-MM-DD, inclusive
}

export interface StrikeAdjustment {
  id: string;
  userId: string;
  semesterId: string | null;
  /** null = full-body strike count; otherwise that group's count. */
  groupId: string | null;
  points: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  target: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export type GroupKind = "team" | "core" | "leads" | "event";

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  team: "Team",
  core: "Core",
  leads: "Leads (sub-core)",
  event: "Event team",
};

export const GROUP_KIND_HELP: Record<GroupKind, string> = {
  team: "A working team, e.g. Marketing, Tech or Design, with its own meetings.",
  core: "The core team.",
  leads: "All the leads (sub-core) together, for leads meetings.",
  event: "A temporary team for one event. Give it an end date and it is archived afterwards.",
};

export interface Group {
  id: string;
  name: string;
  kind: GroupKind;
  endsOn: string | null; // YYYY-MM-DD; event teams stop being active after this
  archived: boolean;
  createdAt: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: "member" | "lead";
  addedAt: string;
}
