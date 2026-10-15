import type {
  Attendance, AuditEntry, Excuse, Group, GroupMember, Meeting, Passkey, Profile, RosterEntry, Semester, StrikeAdjustment,
} from "../types";
import { createAdminClient } from "../supabase/admin";
import type { Repo } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const toProfile = (r: Row): Profile => ({ id: r.id, email: r.email, name: r.name, rollNo: r.roll_no, role: r.role, active: r.active, createdAt: r.created_at });
const toRoster = (r: Row): RosterEntry => ({ email: r.email, name: r.name, rollNo: r.roll_no, role: r.role, addedAt: r.added_at });
const toPasskey = (r: Row): Passkey => ({ userId: r.user_id, credentialId: r.credential_id, publicKey: r.public_key, counter: Number(r.counter), transports: r.transports, deviceId: r.device_id, createdAt: r.created_at });
const toMeeting = (r: Row): Meeting => ({ id: r.id, title: r.title, startsAt: r.starts_at, graceMinutes: r.grace_minutes, status: r.status, qrSecret: r.qr_secret, groupId: r.group_id ?? null, createdBy: r.created_by, createdAt: r.created_at });
const toAttendance = (r: Row): Attendance => ({ meetingId: r.meeting_id, userId: r.user_id, status: r.status, checkedInAt: r.checked_in_at, credentialId: r.credential_id, deviceId: r.device_id, source: r.source, flags: r.flags ?? [] });
const fromAttendance = (a: Attendance): Row => ({ meeting_id: a.meetingId, user_id: a.userId, status: a.status, checked_in_at: a.checkedInAt, credential_id: a.credentialId, device_id: a.deviceId, source: a.source, flags: a.flags });
const toExcuse = (r: Row): Excuse => ({ id: r.id, meetingId: r.meeting_id, userId: r.user_id, reason: r.reason, status: r.status, reviewedBy: r.reviewed_by, createdAt: r.created_at });
const toSemester = (r: Row): Semester => ({ id: r.id, name: r.name, startsOn: r.starts_on, endsOn: r.ends_on });
const toAdjustment = (r: Row): StrikeAdjustment => ({ id: r.id, userId: r.user_id, semesterId: r.semester_id, groupId: r.group_id ?? null, points: Number(r.points), reason: r.reason, createdBy: r.created_by, createdAt: r.created_at });
const toGroup = (r: Row): Group => ({ id: r.id, name: r.name, kind: r.kind, endsOn: r.ends_on, archived: r.archived, createdAt: r.created_at });
const toGroupMember = (r: Row): GroupMember => ({ groupId: r.group_id, userId: r.user_id, role: r.role, addedAt: r.added_at });
const toAudit = (r: Row): AuditEntry => ({ id: r.id, actorId: r.actor_id, action: r.action, target: r.target, details: r.details, createdAt: r.created_at });

/** Throws on error. For `.maybeSingle()` the result can still be null at runtime; callers check. */
function check<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// One client per server instance: creating one per query costs time on every call.
let client: ReturnType<typeof createAdminClient> | undefined;
const sb = () => (client ??= createAdminClient());

const PAGE_SIZE = 1000;

/** Supabase (PostgREST) caps each response at 1000 rows by default, so page until a short page. The query must have a stable order. */
export async function fetchAll(query: () => any): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = check<Row[]>(await query().range(from, from + PAGE_SIZE - 1));
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** True when a database function hasn't been created yet (its migration wasn't run). */
const missingFunction = (error: { code?: string }) => error.code === "PGRST202";

export const supabaseRepo: Repo = {
  async getProfile(id) { const r = check(await sb().from("profiles").select().eq("id", id).maybeSingle()); return r ? toProfile(r) : null; },
  async listProfiles() { return (await fetchAll(() => sb().from("profiles").select().order("name").order("id"))).map(toProfile); },
  async upsertProfile(p) {
    const r = check<Row>(await sb().from("profiles").upsert({ id: p.id, email: p.email, name: p.name, roll_no: p.rollNo, role: p.role, active: p.active }).select().single());
    return toProfile(r);
  },
  async setProfileActive(id, active) { check(await sb().from("profiles").update({ active }).eq("id", id)); },

  async getRosterEntry(email) { const r = check(await sb().from("roster").select().eq("email", email.toLowerCase()).maybeSingle()); return r ? toRoster(r) : null; },
  async listRoster() { return (await fetchAll(() => sb().from("roster").select().order("name").order("email"))).map(toRoster); },
  async upsertRoster(entries) {
    check(await sb().from("roster").upsert(entries.map((e) => ({ email: e.email, name: e.name, roll_no: e.rollNo, role: e.role }))));
  },

  async getPasskeyByUser(userId) { const r = check(await sb().from("passkeys").select().eq("user_id", userId).maybeSingle()); return r ? toPasskey(r) : null; },
  async listPasskeys() { return (await fetchAll(() => sb().from("passkeys").select().order("user_id"))).map(toPasskey); },
  async getPasskeysByDevice(deviceId) { return check(await sb().from("passkeys").select().eq("device_id", deviceId)).map(toPasskey); },
  async insertPasskey(p) {
    check(await sb().from("passkeys").insert({ user_id: p.userId, credential_id: p.credentialId, public_key: p.publicKey, counter: p.counter, transports: p.transports, device_id: p.deviceId }));
  },
  async updatePasskeyCounter(credentialId, counter) { check(await sb().from("passkeys").update({ counter }).eq("credential_id", credentialId)); },
  async deletePasskey(userId) { check(await sb().from("passkeys").delete().eq("user_id", userId)); },

  async listMeetings() { return (await fetchAll(() => sb().from("meetings").select().order("starts_at", { ascending: false }).order("id"))).map(toMeeting); },
  async getMeeting(id) { const r = check(await sb().from("meetings").select().eq("id", id).maybeSingle()); return r ? toMeeting(r) : null; },
  async createMeeting(input) {
    return toMeeting(check(await sb().from("meetings").insert({ title: input.title, starts_at: input.startsAt, grace_minutes: input.graceMinutes, group_id: input.groupId, created_by: input.createdBy }).select().single()));
  },
  async setMeetingStatus(id, status) { check(await sb().from("meetings").update({ status }).eq("id", id)); },
  // One statement, so it's all-or-nothing; attendance and excuses cascade.
  async deleteMeeting(id) { check(await sb().from("meetings").delete().eq("id", id)); },

  async listAttendanceForMeeting(meetingId) { return (await fetchAll(() => sb().from("attendance").select().eq("meeting_id", meetingId).order("user_id"))).map(toAttendance); },
  async listAttendanceForUser(userId) { return (await fetchAll(() => sb().from("attendance").select().eq("user_id", userId).order("meeting_id"))).map(toAttendance); },
  async listAllAttendance() { return (await fetchAll(() => sb().from("attendance").select().order("meeting_id").order("user_id"))).map(toAttendance); },
  async listAttendanceBetween(fromIso, toIso) {
    return (await fetchAll(() => sb().from("attendance").select("*, meetings!inner(starts_at)")
      .gte("meetings.starts_at", fromIso).lt("meetings.starts_at", toIso)
      .order("meeting_id").order("user_id"))).map(toAttendance);
  },
  async getAttendance(meetingId, userId) {
    const r = check(await sb().from("attendance").select().eq("meeting_id", meetingId).eq("user_id", userId).maybeSingle());
    return r ? toAttendance(r) : null;
  },
  async checkedInCounts() {
    const rows = await fetchAll(() => sb().from("attendance").select("meeting_id").in("status", ["present", "late"]).order("meeting_id").order("user_id"));
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.meeting_id, (counts.get(r.meeting_id) ?? 0) + 1);
    return counts;
  },
  async insertAttendance(a) {
    const conflict = (e: { code?: string; message: string }) =>
      e.code === "23505" ? (e.message.includes("attendance_meeting_device_uniq") ? "duplicate_device" : "duplicate_user") : null;
    const { error } = await sb().from("attendance").insert(fromAttendance(a));
    if (!error) return "ok";
    const first = conflict(error);
    if (!first) throw new Error(error.message);
    if (first === "duplicate_device") return first;
    // Already has a row: replace it only if it's an absence or excuse (they turned up after all).
    const { data, error: updateError } = await sb().from("attendance").update(fromAttendance(a))
      .eq("meeting_id", a.meetingId).eq("user_id", a.userId).in("status", ["absent", "excused"]).select("user_id");
    if (updateError) {
      const second = conflict(updateError);
      if (second) return second;
      throw new Error(updateError.message);
    }
    return data?.length ? "ok" : "duplicate_user";
  },
  async upsertAttendance(a) { check(await sb().from("attendance").upsert(fromAttendance(a))); },
  async insertMissingAttendance(rows) {
    for (let i = 0; i < rows.length; i += PAGE_SIZE) {
      check(await sb().from("attendance").upsert(rows.slice(i, i + PAGE_SIZE).map(fromAttendance), { onConflict: "meeting_id,user_id", ignoreDuplicates: true }));
    }
  },

  async listExcuses(filter = {}) {
    return (await fetchAll(() => {
      let q = sb().from("excuses").select();
      if (filter.userId) q = q.eq("user_id", filter.userId);
      if (filter.meetingId) q = q.eq("meeting_id", filter.meetingId);
      if (filter.status) q = q.eq("status", filter.status);
      return q.order("created_at", { ascending: false }).order("id");
    })).map(toExcuse);
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

  async deleteSemester(id) { check(await sb().from("semesters").delete().eq("id", id)); },

  async listAdjustments(userId) {
    return (await fetchAll(() => {
      let q = sb().from("strike_adjustments").select();
      if (userId) q = q.eq("user_id", userId);
      return q.order("created_at", { ascending: false }).order("id");
    })).map(toAdjustment);
  },
  async addAdjustment(input) {
    check(await sb().from("strike_adjustments").insert({ user_id: input.userId, semester_id: input.semesterId, group_id: input.groupId, points: input.points, reason: input.reason, created_by: input.createdBy }));
  },

  async listGroups() { return (await fetchAll(() => sb().from("groups").select().order("name").order("id"))).map(toGroup); },
  async getGroup(id) { const r = check(await sb().from("groups").select().eq("id", id).maybeSingle()); return r ? toGroup(r) : null; },
  async createGroup(input) {
    return toGroup(check(await sb().from("groups").insert({ name: input.name, kind: input.kind, ends_on: input.endsOn }).select().single()));
  },
  async updateGroup(id, patch) {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.endsOn !== undefined) row.ends_on = patch.endsOn;
    if (patch.archived !== undefined) row.archived = patch.archived;
    check(await sb().from("groups").update(row).eq("id", id));
  },
  async listGroupMembers(groupId) {
    return (await fetchAll(() => {
      let q = sb().from("group_members").select();
      if (groupId) q = q.eq("group_id", groupId);
      return q.order("group_id").order("user_id");
    })).map(toGroupMember);
  },
  async listMembershipsForUser(userId) {
    return check(await sb().from("group_members").select().eq("user_id", userId)).map(toGroupMember);
  },
  async setGroupMember(groupId, userId, role) {
    check(await sb().from("group_members").upsert({ group_id: groupId, user_id: userId, role }, { onConflict: "group_id,user_id" }));
  },
  async removeGroupMember(groupId, userId) { check(await sb().from("group_members").delete().eq("group_id", groupId).eq("user_id", userId)); },

  async deleteGroup(id) {
    const { error } = await sb().rpc("delete_group", { gid: id });
    if (!error) return;
    if (!missingFunction(error)) throw new Error(error.message);
    // Fallback until migration 0007 is run. Meetings would otherwise fall back to "full body"; attendance and excuses cascade.
    check(await sb().from("meetings").delete().eq("group_id", id));
    check(await sb().from("strike_adjustments").delete().eq("group_id", id));
    check(await sb().from("groups").delete().eq("id", id));
  },
  async deleteMember(userId) {
    const { error: rpcError } = await sb().rpc("delete_member", { uid: userId });
    if (!rpcError) return;
    if (!missingFunction(rpcError)) throw new Error(rpcError.message);
    // Fallback until migration 0007 is run.
    const r = check<Row | null>(await sb().from("profiles").select("email").eq("id", userId).maybeSingle());
    // Deleting the auth user cascades to the profile and everything that references it.
    const { error } = await sb().auth.admin.deleteUser(userId);
    if (error && !/not found/i.test(error.message)) throw new Error(error.message);
    check(await sb().from("profiles").delete().eq("id", userId));
    if (r?.email) check(await sb().from("roster").delete().eq("email", r.email));
  },
  async deleteRosterEntry(email) { check(await sb().from("roster").delete().eq("email", email.toLowerCase())); },

  async addAudit(input) { check(await sb().from("audit_log").insert({ actor_id: input.actorId, action: input.action, target: input.target, details: input.details })); },
  async listAudit(limit) { return check(await sb().from("audit_log").select().order("created_at", { ascending: false }).limit(limit)).map(toAudit); },
};
