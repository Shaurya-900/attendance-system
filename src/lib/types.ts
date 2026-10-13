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
