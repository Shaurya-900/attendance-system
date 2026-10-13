import { randomBytes, randomUUID } from "node:crypto";
import type {
  Attendance, AuditEntry, Excuse, Meeting, Passkey, Profile, RosterEntry, Semester, StrikeAdjustment,
} from "../types";
import type { Repo } from "./types";

/** In-process store for local demos and e2e tests. Data is lost on restart. */
interface Store {
  profiles: Profile[];
  roster: RosterEntry[];
  passkeys: Passkey[];
  meetings: Meeting[];
  attendance: Attendance[];
  excuses: Excuse[];
  semesters: Semester[];
  adjustments: StrikeAdjustment[];
  audit: AuditEntry[];
}

function seed(): Store {
  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  const people: RosterEntry[] = [
    { email: "admin@ecell.test", name: "Core Admin", rollNo: "ADM001", role: "admin" },
    { email: "alice@ecell.test", name: "Alice Member", rollNo: "21BCE001", role: "member" },
    { email: "bob@ecell.test", name: "Bob Member", rollNo: "21BCE002", role: "member" },
    { email: "carol@ecell.test", name: "Carol Member", rollNo: "21BCE003", role: "member" },
  ];
  return {
    roster: people,
    profiles: people.map((p, i) => ({ id: `user-${i}`, ...p, active: true, createdAt: now })),
    passkeys: [],
    meetings: [],
    attendance: [],
    excuses: [],
    semesters: [{ id: "sem-demo", name: `${year} (demo)`, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` }],
    adjustments: [],
    audit: [],
  };
}

const g = globalThis as unknown as { __ecellStore?: Store };
const db = (): Store => (g.__ecellStore ??= seed());
const clone = <T>(v: T): T => structuredClone(v);

export const memoryRepo: Repo = {
  async getProfile(id) { return clone(db().profiles.find((p) => p.id === id) ?? null); },
  async listProfiles() { return clone(db().profiles); },
  async upsertProfile(p) {
    const existing = db().profiles.find((x) => x.id === p.id);
    if (existing) { Object.assign(existing, p); return clone(existing); }
    const row = { ...p, createdAt: new Date().toISOString() };
    db().profiles.push(row);
    return clone(row);
  },
  async setProfileActive(id, active) { const p = db().profiles.find((x) => x.id === id); if (p) p.active = active; },

  async getRosterEntry(email) { return clone(db().roster.find((r) => r.email === email.toLowerCase()) ?? null); },
  async listRoster() { return clone(db().roster); },
  async upsertRoster(entries) {
    for (const e of entries) {
      const i = db().roster.findIndex((r) => r.email === e.email);
      if (i >= 0) db().roster[i] = e; else db().roster.push(e);
    }
  },

  async getPasskeyByUser(userId) { return clone(db().passkeys.find((p) => p.userId === userId) ?? null); },
  async listPasskeys() { return clone(db().passkeys); },
  async getPasskeysByDevice(deviceId) { return clone(db().passkeys.filter((p) => p.deviceId === deviceId)); },
  async insertPasskey(p) {
    if (db().passkeys.some((x) => x.userId === p.userId || x.credentialId === p.credentialId)) throw new Error("passkey exists");
    db().passkeys.push({ ...p, createdAt: new Date().toISOString() });
  },
  async updatePasskeyCounter(credentialId, counter) { const p = db().passkeys.find((x) => x.credentialId === credentialId); if (p) p.counter = counter; },
  async deletePasskey(userId) { db().passkeys = db().passkeys.filter((p) => p.userId !== userId); },

  async listMeetings() { return clone([...db().meetings].sort((a, b) => b.startsAt.localeCompare(a.startsAt))); },
  async getMeeting(id) { return clone(db().meetings.find((m) => m.id === id) ?? null); },
  async createMeeting(input) {
    const m: Meeting = { id: randomUUID(), ...input, status: "scheduled", qrSecret: randomBytes(32).toString("hex"), createdAt: new Date().toISOString() };
    db().meetings.push(m);
    return clone(m);
  },
  async setMeetingStatus(id, status) { const m = db().meetings.find((x) => x.id === id); if (m) m.status = status; },

  async listAttendanceForMeeting(meetingId) { return clone(db().attendance.filter((a) => a.meetingId === meetingId)); },
  async listAttendanceForUser(userId) { return clone(db().attendance.filter((a) => a.userId === userId)); },
  async listAllAttendance() { return clone(db().attendance); },
  async insertAttendance(a) {
    const rows = db().attendance.filter((x) => x.meetingId === a.meetingId);
    if (rows.some((x) => x.userId === a.userId)) return "duplicate_user";
    if (a.source === "qr" && a.deviceId && rows.some((x) => x.source === "qr" && x.deviceId === a.deviceId)) return "duplicate_device";
    db().attendance.push(clone(a));
    return "ok";
  },
  async upsertAttendance(a) {
    const i = db().attendance.findIndex((x) => x.meetingId === a.meetingId && x.userId === a.userId);
    if (i >= 0) db().attendance[i] = clone(a); else db().attendance.push(clone(a));
  },

  async listExcuses(filter = {}) {
    return clone(db().excuses.filter((e) => (!filter.userId || e.userId === filter.userId) && (!filter.status || e.status === filter.status)));
  },
  async getExcuse(id) { return clone(db().excuses.find((e) => e.id === id) ?? null); },
  async createExcuse(input) {
    const e: Excuse = { id: randomUUID(), ...input, status: "pending", reviewedBy: null, createdAt: new Date().toISOString() };
    db().excuses.push(e);
    return clone(e);
  },
  async setExcuseStatus(id, status, reviewedBy) { const e = db().excuses.find((x) => x.id === id); if (e) Object.assign(e, { status, reviewedBy }); },

  async listSemesters() { return clone(db().semesters); },
  async createSemester(input) { const s = { id: randomUUID(), ...input }; db().semesters.push(s); return clone(s); },

  async deleteSemester(id) { db().semesters = db().semesters.filter((s) => s.id !== id); },

  async listAdjustments(userId) { return clone(db().adjustments.filter((a) => !userId || a.userId === userId)); },
  async addAdjustment(input) { db().adjustments.push({ id: randomUUID(), ...input, createdAt: new Date().toISOString() }); },

  async addAudit(input) { db().audit.unshift({ id: randomUUID(), ...input, createdAt: new Date().toISOString() }); },
  async listAudit(limit) { return clone(db().audit.slice(0, limit)); },
};
