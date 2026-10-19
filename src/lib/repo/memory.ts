import { randomBytes, randomUUID } from "node:crypto";
import type {
  Attendance, AuditEntry, Excuse, Group, GroupMember, Meeting, MemberEdit, Passkey, Profile, RosterEntry, RosterGroup, Semester, StrikeAdjustment,
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
  groups: Group[];
  groupMembers: GroupMember[];
  rosterGroups: RosterGroup[];
  memberEdits: MemberEdit[];
  audit: AuditEntry[];
}

function seed(): Store {
  const now = new Date().toISOString();
  const year = new Date().getFullYear();
  const people: RosterEntry[] = [
    { email: "admin@ecell.test", name: "Core Admin", rollNo: "22010110001", role: "admin" },
    { email: "alice@ecell.test", name: "Alice Member", rollNo: "2410110001", role: "member" },
    { email: "bob@ecell.test", name: "Bob Member", rollNo: "2410110002", role: "member" },
    { email: "carol@ecell.test", name: "Carol Member", rollNo: "2410110003", role: "member" },
    { email: "dana@ecell.test", name: "Dana Advisor", rollNo: null, role: "advisor" },
  ];
  return {
    roster: people.map((p) => ({ ...p, addedAt: now })),
    // The demo admin is an approver, so edits can be tried end to end.
    profiles: people.map((p, i) => ({ id: `user-${i}`, ...p, active: true, approver: p.role === "admin", createdAt: now })),
    passkeys: [],
    meetings: [],
    attendance: [],
    excuses: [],
    semesters: [{ id: "sem-demo", name: `${year} (demo)`, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` }],
    adjustments: [],
    groups: [],
    groupMembers: [],
    rosterGroups: [],
    memberEdits: [],
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
      if (i >= 0) db().roster[i] = { ...e, addedAt: db().roster[i].addedAt };
      else db().roster.push({ ...e, addedAt: new Date().toISOString() });
    }
  },
  async updateRosterEntry(oldEmail, e) {
    const r = db().roster.find((x) => x.email === oldEmail);
    if (!r) return;
    Object.assign(r, { email: e.email, name: e.name, rollNo: e.rollNo, role: e.role });
    for (const rg of db().rosterGroups) if (rg.email === oldEmail) rg.email = e.email;
  },
  async updateAuthEmail() {}, // demo logins aren't tied to an email

  async listRosterGroups(filter = {}) {
    return clone(db().rosterGroups.filter((r) => (!filter.email || r.email === filter.email) && (!filter.groupId || r.groupId === filter.groupId)));
  },
  async addRosterGroup(email, groupId) {
    if (!db().rosterGroups.some((r) => r.email === email && r.groupId === groupId)) db().rosterGroups.push({ email, groupId });
  },
  async removeRosterGroup(email, groupId) {
    db().rosterGroups = db().rosterGroups.filter((r) => !(r.email === email && r.groupId === groupId));
  },

  async listMemberEdits(status) {
    return clone(db().memberEdits.filter((e) => !status || e.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  },
  async getMemberEdit(id) { return clone(db().memberEdits.find((e) => e.id === id) ?? null); },
  async createMemberEdit(input) {
    const e: MemberEdit = { id: randomUUID(), ...clone(input), status: "pending", reviewedBy: null, createdAt: new Date().toISOString() };
    db().memberEdits.push(e);
    return clone(e);
  },
  async setMemberEditStatus(id, status, reviewedBy) { const e = db().memberEdits.find((x) => x.id === id); if (e) Object.assign(e, { status, reviewedBy }); },

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
  async deleteMeeting(id) {
    const s = db();
    s.meetings = s.meetings.filter((m) => m.id !== id);
    s.attendance = s.attendance.filter((a) => a.meetingId !== id);
    s.excuses = s.excuses.filter((e) => e.meetingId !== id);
  },

  async listAttendanceForMeeting(meetingId) { return clone(db().attendance.filter((a) => a.meetingId === meetingId)); },
  async listAttendanceForUser(userId) { return clone(db().attendance.filter((a) => a.userId === userId)); },
  async listAllAttendance() { return clone(db().attendance); },
  async listAttendanceBetween(fromIso, toIso) {
    const ids = new Set(db().meetings.filter((m) => m.startsAt >= fromIso && m.startsAt < toIso).map((m) => m.id));
    return clone(db().attendance.filter((a) => ids.has(a.meetingId)));
  },
  async getAttendance(meetingId, userId) { return clone(db().attendance.find((a) => a.meetingId === meetingId && a.userId === userId) ?? null); },
  async checkedInCounts() {
    const counts = new Map<string, number>();
    for (const a of db().attendance) if (a.status === "present" || a.status === "late") counts.set(a.meetingId, (counts.get(a.meetingId) ?? 0) + 1);
    return counts;
  },
  async insertAttendance(a) {
    const rows = db().attendance.filter((x) => x.meetingId === a.meetingId);
    const mine = rows.find((x) => x.userId === a.userId);
    if (mine && mine.status !== "absent" && mine.status !== "excused") return "duplicate_user";
    if (a.source === "qr" && a.deviceId && rows.some((x) => x !== mine && x.source === "qr" && x.deviceId === a.deviceId)) return "duplicate_device";
    if (mine) Object.assign(mine, clone(a)); else db().attendance.push(clone(a));
    return "ok";
  },
  async upsertAttendance(a) {
    const i = db().attendance.findIndex((x) => x.meetingId === a.meetingId && x.userId === a.userId);
    if (i >= 0) db().attendance[i] = clone(a); else db().attendance.push(clone(a));
  },
  async insertMissingAttendance(rows) {
    for (const a of rows) {
      if (!db().attendance.some((x) => x.meetingId === a.meetingId && x.userId === a.userId)) db().attendance.push(clone(a));
    }
  },

  async listExcuses(filter = {}) {
    return clone(db().excuses.filter((e) => (!filter.userId || e.userId === filter.userId) && (!filter.meetingId || e.meetingId === filter.meetingId) && (!filter.status || e.status === filter.status)));
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

  async listGroups() { return clone([...db().groups].sort((a, b) => a.name.localeCompare(b.name))); },
  async getGroup(id) { return clone(db().groups.find((g) => g.id === id) ?? null); },
  async createGroup(input) {
    const g: Group = { id: randomUUID(), ...input, archived: false, createdAt: new Date().toISOString() };
    db().groups.push(g);
    return clone(g);
  },
  async updateGroup(id, patch) { const g = db().groups.find((x) => x.id === id); if (g) Object.assign(g, patch); },
  async listGroupMembers(groupId) { return clone(db().groupMembers.filter((m) => !groupId || m.groupId === groupId)); },
  async listMembershipsForUser(userId) { return clone(db().groupMembers.filter((m) => m.userId === userId)); },
  async setGroupMember(groupId, userId, role) {
    const m = db().groupMembers.find((x) => x.groupId === groupId && x.userId === userId);
    if (m) m.role = role;
    else db().groupMembers.push({ groupId, userId, role, addedAt: new Date().toISOString() });
  },
  async removeGroupMember(groupId, userId) {
    db().groupMembers = db().groupMembers.filter((m) => !(m.groupId === groupId && m.userId === userId));
  },

  async deleteGroup(id) {
    const s = db();
    const meetingIds = new Set(s.meetings.filter((m) => m.groupId === id).map((m) => m.id));
    s.meetings = s.meetings.filter((m) => !meetingIds.has(m.id));
    s.attendance = s.attendance.filter((a) => !meetingIds.has(a.meetingId));
    s.excuses = s.excuses.filter((e) => !meetingIds.has(e.meetingId));
    s.adjustments = s.adjustments.filter((a) => a.groupId !== id);
    s.groupMembers = s.groupMembers.filter((m) => m.groupId !== id);
    s.rosterGroups = s.rosterGroups.filter((r) => r.groupId !== id);
    s.groups = s.groups.filter((g) => g.id !== id);
  },
  async deleteMember(userId) {
    const s = db();
    const email = s.profiles.find((p) => p.id === userId)?.email;
    s.profiles = s.profiles.filter((p) => p.id !== userId);
    s.passkeys = s.passkeys.filter((p) => p.userId !== userId);
    s.attendance = s.attendance.filter((a) => a.userId !== userId);
    s.excuses = s.excuses.filter((e) => e.userId !== userId);
    s.adjustments = s.adjustments.filter((a) => a.userId !== userId).map((a) => (a.createdBy === userId ? { ...a, createdBy: null } : a));
    s.groupMembers = s.groupMembers.filter((m) => m.userId !== userId);
    if (email) s.roster = s.roster.filter((r) => r.email !== email);
    if (email) s.rosterGroups = s.rosterGroups.filter((r) => r.email !== email);
  },
  async deleteRosterEntry(email) {
    db().roster = db().roster.filter((r) => r.email !== email.toLowerCase());
    db().rosterGroups = db().rosterGroups.filter((r) => r.email !== email.toLowerCase());
  },

  async addAudit(input) { db().audit.unshift({ id: randomUUID(), ...input, createdAt: new Date().toISOString() }); },
  async listAudit(limit) { return clone(db().audit.slice(0, limit)); },
};
