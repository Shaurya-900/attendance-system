import type {
  Attendance, AuditEntry, Excuse, Meeting, Passkey, Profile, RosterEntry, Semester, StrikeAdjustment,
} from "../types";
import { createAdminClient } from "../supabase/admin";
import type { Repo } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toProfile = (r: Row): Profile => ({ id: r.id, email: r.email, name: r.name, rollNo: r.roll_no, role: r.role, active: r.active, createdAt: r.created_at });
const toRoster = (r: Row): RosterEntry => ({ email: r.email, name: r.name, rollNo: r.roll_no, role: r.role });
const toPasskey = (r: Row): Passkey => ({ userId: r.user_id, credentialId: r.credential_id, publicKey: r.public_key, counter: Number(r.counter), transports: r.transports, deviceId: r.device_id, createdAt: r.created_at });
const toMeeting = (r: Row): Meeting => ({ id: r.id, title: r.title, startsAt: r.starts_at, graceMinutes: r.grace_minutes, status: r.status, qrSecret: r.qr_secret, createdBy: r.created_by, createdAt: r.created_at });
const toAttendance = (r: Row): Attendance => ({ meetingId: r.meeting_id, userId: r.user_id, status: r.status, checkedInAt: r.checked_in_at, credentialId: r.credential_id, deviceId: r.device_id, source: r.source, flags: r.flags ?? [] });
const fromAttendance = (a: Attendance): Row => ({ meeting_id: a.meetingId, user_id: a.userId, status: a.status, checked_in_at: a.checkedInAt, credential_id: a.credentialId, device_id: a.deviceId, source: a.source, flags: a.flags });
const toExcuse = (r: Row): Excuse => ({ id: r.id, meetingId: r.meeting_id, userId: r.user_id, reason: r.reason, status: r.status, reviewedBy: r.reviewed_by, createdAt: r.created_at });
const toSemester = (r: Row): Semester => ({ id: r.id, name: r.name, startsOn: r.starts_on, endsOn: r.ends_on });
const toAdjustment = (r: Row): StrikeAdjustment => ({ id: r.id, userId: r.user_id, semesterId: r.semester_id, points: Number(r.points), reason: r.reason, createdBy: r.created_by, createdAt: r.created_at });
const toAudit = (r: Row): AuditEntry => ({ id: r.id, actorId: r.actor_id, action: r.action, target: r.target, details: r.details, createdAt: r.created_at });

/** Throws on error. For `.maybeSingle()` the result can still be null at runtime — callers check. */
function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

const sb = () => createAdminClient();

export const supabaseRepo: Repo = {
  async getProfile(id) { const r = check(await sb().from("profiles").select().eq("id", id).maybeSingle()); return r ? toProfile(r) : null; },
  async listProfiles() { return check(await sb().from("profiles").select().order("name")).map(toProfile); },
  async upsertProfile(p) {
    const r = check<Row>(await sb().from("profiles").upsert({ id: p.id, email: p.email, name: p.name, roll_no: p.rollNo, role: p.role, active: p.active }).select().single());
    return toProfile(r);
  },
  async setProfileActive(id, active) { check(await sb().from("profiles").update({ active }).eq("id", id)); },

  async getRosterEntry(email) { const r = check(await sb().from("roster").select().eq("email", email.toLowerCase()).maybeSingle()); return r ? toRoster(r) : null; },
  async listRoster() { return check(await sb().from("roster").select().order("name")).map(toRoster); },
  async upsertRoster(entries) {
    check(await sb().from("roster").upsert(entries.map((e) => ({ email: e.email, name: e.name, roll_no: e.rollNo, role: e.role }))));
  },

  async getPasskeyByUser(userId) { const r = check(await sb().from("passkeys").select().eq("user_id", userId).maybeSingle()); return r ? toPasskey(r) : null; },
  async listPasskeys() { return check(await sb().from("passkeys").select()).map(toPasskey); },
  async getPasskeysByDevice(deviceId) { return check(await sb().from("passkeys").select().eq("device_id", deviceId)).map(toPasskey); },
  async insertPasskey(p) {
    check(await sb().from("passkeys").insert({ user_id: p.userId, credential_id: p.credentialId, public_key: p.publicKey, counter: p.counter, transports: p.transports, device_id: p.deviceId }));
  },
  async updatePasskeyCounter(credentialId, counter) { check(await sb().from("passkeys").update({ counter }).eq("credential_id", credentialId)); },
  async deletePasskey(userId) { check(await sb().from("passkeys").delete().eq("user_id", userId)); },

  async listMeetings() { return check(await sb().from("meetings").select().order("starts_at", { ascending: false })).map(toMeeting); },
  async getMeeting(id) { const r = check(await sb().from("meetings").select().eq("id", id).maybeSingle()); return r ? toMeeting(r) : null; },
  async createMeeting(input) {
    return toMeeting(check(await sb().from("meetings").insert({ title: input.title, starts_at: input.startsAt, grace_minutes: input.graceMinutes, created_by: input.createdBy }).select().single()));
  },
  async setMeetingStatus(id, status) { check(await sb().from("meetings").update({ status }).eq("id", id)); },

  async listAttendanceForMeeting(meetingId) { return check(await sb().from("attendance").select().eq("meeting_id", meetingId)).map(toAttendance); },
  async listAttendanceForUser(userId) { return check(await sb().from("attendance").select().eq("user_id", userId)).map(toAttendance); },
  async listAllAttendance() { return check(await sb().from("attendance").select()).map(toAttendance); },
  async insertAttendance(a) {
    const { error } = await sb().from("attendance").insert(fromAttendance(a));
    if (!error) return "ok";
    if ((error as { code?: string }).code === "23505") {
      return error.message.includes("attendance_meeting_device_uniq") ? "duplicate_device" : "duplicate_user";
    }
    throw new Error(error.message);
  },
  async upsertAttendance(a) { check(await sb().from("attendance").upsert(fromAttendance(a))); },

  async listExcuses(filter = {}) {
    let q = sb().from("excuses").select().order("created_at", { ascending: false });
    if (filter.userId) q = q.eq("user_id", filter.userId);
    if (filter.status) q = q.eq("status", filter.status);
    return check(await q).map(toExcuse);
  },
  async getExcuse(id) { const r = check(await sb().from("excuses").select().eq("id", id).maybeSingle()); return r ? toExcuse(r) : null; },
  async createExcuse(input) {
    return toExcuse(check(await sb().from("excuses").insert({ meeting_id: input.meetingId, user_id: input.userId, reason: input.reason }).select().single()));
  },
  async setExcuseStatus(id, status, reviewedBy) { check(await sb().from("excuses").update({ status, reviewed_by: reviewedBy }).eq("id", id)); },

  async listSemesters() { return check(await sb().from("semesters").select().order("starts_on", { ascending: false })).map(toSemester); },
  async createSemester(input) {
    return toSemester(check(await sb().from("semesters").insert({ name: input.name, starts_on: input.startsOn, ends_on: input.endsOn }).select().single()));
  },

  async listAdjustments(userId) {
    let q = sb().from("strike_adjustments").select().order("created_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    return check(await q).map(toAdjustment);
  },
  async addAdjustment(input) {
    check(await sb().from("strike_adjustments").insert({ user_id: input.userId, semester_id: input.semesterId, points: input.points, reason: input.reason, created_by: input.createdBy }));
  },

  async addAudit(input) { check(await sb().from("audit_log").insert({ actor_id: input.actorId, action: input.action, target: input.target, details: input.details })); },
  async listAudit(limit) { return check(await sb().from("audit_log").select().order("created_at", { ascending: false }).limit(limit)).map(toAudit); },
};
