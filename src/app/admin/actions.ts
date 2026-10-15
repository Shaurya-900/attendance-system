"use server";

import { revalidatePath } from "next/cache";

/** Clear every cached page: one change can affect lists, dropdowns and strike counts elsewhere. */
function refreshAll() {
  revalidatePath("/", "layout");
}
import { redirect } from "next/navigation";
import { z } from "zod";
import { canManageGroup, requireAdmin, requireStaff } from "@/lib/auth";
import { applyApprovedExcuse, closeMeeting, expectedMembers } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import type { AttendanceStatus, Meeting, Role } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Admins manage every meeting; group leads only their own group's meetings. */
async function requireMeetingManager(meetingId: string): Promise<{ actorId: string; meeting: Meeting }> {
  const staff = await requireStaff();
  const meeting = await getRepo().getMeeting(meetingId);
  if (!meeting || !canManageGroup(staff, meeting.groupId)) redirect("/admin/meetings");
  return { actorId: staff.user.id, meeting };
}

async function requireGroupManager(groupId: string) {
  const staff = await requireStaff();
  if (!canManageGroup(staff, groupId)) redirect("/admin");
  return staff;
}

export async function createMeeting(_prev: FormState, formData: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const groupId = str(formData, "groupId") || null;
  if (!canManageGroup(staff, groupId)) redirect("/admin/meetings");
  const parsed = z.object({
    title: z.string().min(1).max(120),
    startsAt: z.string().datetime({ offset: true }),
    graceMinutes: z.coerce.number().int().min(0).max(120),
  }).safeParse({ title: str(formData, "title"), startsAt: str(formData, "startsAt"), graceMinutes: str(formData, "graceMinutes") || 10 });
  if (!parsed.success) return { error: "Fill in a title and start time, and keep 'Mark late after' between 0 and 120 minutes." };
  const input = parsed.data;
  const repo = getRepo();
  // A double click (or a retry on a slow connection) must not create the same meeting twice.
  const recent = Date.now() - 60_000;
  const duplicate = (await repo.listMeetings()).find((m) =>
    m.title === input.title && Date.parse(m.startsAt) === Date.parse(input.startsAt) && m.groupId === groupId &&
    m.createdBy === staff.user.id && Date.parse(m.createdAt) > recent);
  const meeting = duplicate ?? await repo.createMeeting({ ...input, startsAt: new Date(input.startsAt).toISOString(), groupId, createdBy: staff.user.id });
  refreshAll();
  redirect(`/admin/meetings/${meeting.id}`);
}

export async function startMeeting(formData: FormData) {
  const id = str(formData, "meetingId");
  const { actorId, meeting } = await requireMeetingManager(id);
  const repo = getRepo();
  if (meeting.status !== "scheduled") return;
  await repo.setMeetingStatus(id, "live");
  await repo.addAudit({ actorId, action: "meeting.start", target: id, details: {} });
  refreshAll();
  redirect(`/admin/meetings/${id}/live`);
}

export async function deleteMeeting(formData: FormData) {
  const id = str(formData, "meetingId");
  const { actorId, meeting } = await requireMeetingManager(id);
  await getRepo().deleteMeeting(id);
  await getRepo().addAudit({ actorId, action: "meeting.delete", target: id, details: { title: meeting.title, startsAt: meeting.startsAt, groupId: meeting.groupId } });
  refreshAll();
  redirect("/admin/meetings");
}

export async function endMeeting(formData: FormData) {
  const id = str(formData, "meetingId");
  const { actorId } = await requireMeetingManager(id);
  await closeMeeting(getRepo(), id, actorId);
  refreshAll();
  redirect(`/admin/meetings/${id}`);
}

export async function overrideAttendance(formData: FormData) {
  const meetingId = str(formData, "meetingId");
  const { actorId, meeting } = await requireMeetingManager(meetingId);
  const userId = str(formData, "userId");
  const parsedStatus = z.enum(["present", "late", "absent", "excused"]).safeParse(str(formData, "status"));
  const reason = str(formData, "reason");
  if (!parsedStatus.success || !reason) return;
  const status: AttendanceStatus = parsedStatus.data;
  const repo = getRepo();
  const [prev, expected] = await Promise.all([repo.getAttendance(meetingId, userId), expectedMembers(repo, meeting)]);
  // Only people this meeting is for (or who already have a record), so a lead can't mark outsiders.
  if (!prev && !expected.some((p) => p.id === userId)) return;
  await repo.upsertAttendance({
    meetingId, userId, status,
    checkedInAt: prev?.checkedInAt ?? null, credentialId: prev?.credentialId ?? null, deviceId: prev?.deviceId ?? null,
    source: "manual", flags: prev?.flags ?? [],
  });
  await repo.addAudit({ actorId, action: "attendance.override", target: userId, details: { meetingId, from: prev?.status ?? null, to: status, reason } });
  refreshAll();
}

export async function reviewExcuse(formData: FormData) {
  const id = str(formData, "excuseId");
  const parsedDecision = z.enum(["approved", "rejected"]).safeParse(str(formData, "decision"));
  if (!parsedDecision.success) return;
  const decision = parsedDecision.data;
  const repo = getRepo();
  const excuse = await repo.getExcuse(id);
  if (!excuse || excuse.status !== "pending") return;
  const { actorId } = await requireMeetingManager(excuse.meetingId);
  await repo.setExcuseStatus(id, decision, actorId);
  if (decision === "approved") await applyApprovedExcuse(repo, excuse.meetingId, excuse.userId);
  await repo.addAudit({ actorId, action: `excuse.${decision}`, target: excuse.userId, details: { meetingId: excuse.meetingId } });
  refreshAll();
}

export async function adjustStrikes(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const parsedPoints = z.coerce.number().min(-10).max(10).refine((n) => n !== 0).safeParse(str(formData, "points"));
  const reason = str(formData, "reason");
  if (!parsedPoints.success || !reason) return;
  const points = parsedPoints.data;
  const semesterId = str(formData, "semesterId") || null;
  const groupId = str(formData, "groupId") || null;
  const repo = getRepo();
  await repo.addAdjustment({ userId, semesterId, groupId, points, reason, createdBy: admin.id });
  await repo.addAudit({ actorId: admin.id, action: "strikes.adjust", target: userId, details: { points, reason, semesterId, groupId } });
  refreshAll();
}

export async function resetPasskey(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const repo = getRepo();
  await repo.deletePasskey(userId);
  await repo.addAudit({ actorId: admin.id, action: "passkey.reset", target: userId, details: {} });
  refreshAll();
}

export async function setActive(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const active = str(formData, "active") === "true";
  if (userId === admin.id) return;
  const repo = getRepo();
  await repo.setProfileActive(userId, active);
  await repo.addAudit({ actorId: admin.id, action: active ? "member.activate" : "member.deactivate", target: userId, details: {} });
  refreshAll();
}

/** CSV lines: email,name,roll_no[,role]; a header row is optional. */
export async function importRoster(formData: FormData) {
  const admin = await requireAdmin();
  const entries = str(formData, "csv").split(/\r?\n/).flatMap((line) => {
    const [email, name, rollNo, role] = line.split(",").map((s) => s.trim());
    if (!email || !email.includes("@") || !name) return [];
    return [{ email: email.toLowerCase(), name, rollNo: rollNo || null, role: (role === "admin" ? "admin" : "member") as Role }];
  });
  if (entries.length === 0) return;
  const repo = getRepo();
  await repo.upsertRoster(entries);
  // Keep signed-up members in sync, so e.g. promoting someone to admin takes effect.
  const byEmail = new Map(entries.map((e) => [e.email, e]));
  await Promise.all((await repo.listProfiles()).flatMap((p) => {
    const e = byEmail.get(p.email);
    if (!e || p.id === admin.id || (e.name === p.name && e.rollNo === p.rollNo && e.role === p.role)) return [];
    return [repo.upsertProfile({ ...p, name: e.name, rollNo: e.rollNo, role: e.role })];
  }));
  await repo.addAudit({ actorId: admin.id, action: "roster.import", target: null, details: { count: entries.length } });
  refreshAll();
}

export type FormState = { error?: string; ok?: string } | null;

export async function createSemester(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z.object({ name: z.string().min(1), startsOn: z.string().date(), endsOn: z.string().date() })
    .safeParse({ name: str(formData, "name"), startsOn: str(formData, "startsOn"), endsOn: str(formData, "endsOn") });
  if (!parsed.success) return { error: "Fill in a name and both dates." };
  const input = parsed.data;
  if (input.endsOn < input.startsOn) return { error: "The end date is before the start date." };
  const repo = getRepo();
  const overlap = (await repo.listSemesters()).find((s) => s.startsOn <= input.endsOn && input.startsOn <= s.endsOn);
  if (overlap) return { error: `Overlaps with "${overlap.name}" (${overlap.startsOn} → ${overlap.endsOn}). Delete or adjust that one first.` };
  await repo.createSemester(input);
  await repo.addAudit({ actorId: admin.id, action: "semester.create", target: null, details: input });
  refreshAll();
  return { ok: `Added ${input.name}.` };
}

export async function deleteSemester(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "semesterId");
  const repo = getRepo();
  await repo.deleteSemester(id);
  await repo.addAudit({ actorId: admin.id, action: "semester.delete", target: id, details: { name: str(formData, "name") } });
  refreshAll();
}

export async function createGroup(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z.object({
    name: z.string().min(1).max(80),
    kind: z.enum(["team", "core", "leads", "event"]),
    endsOn: z.union([z.string().date(), z.literal("")]),
  }).safeParse({ name: str(formData, "name"), kind: str(formData, "kind"), endsOn: str(formData, "endsOn") });
  if (!parsed.success) return { error: "Give the group a name and type." };
  const repo = getRepo();
  if ((await repo.listGroups()).some((g) => !g.archived && g.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return { error: `A group called "${parsed.data.name}" already exists.` };
  }
  const group = await repo.createGroup({ name: parsed.data.name, kind: parsed.data.kind, endsOn: parsed.data.endsOn || null });
  await repo.addAudit({ actorId: admin.id, action: "group.create", target: group.id, details: { name: group.name, kind: group.kind } });
  refreshAll();
  redirect(`/admin/groups/${group.id}`);
}

export async function setGroupArchived(formData: FormData) {
  const admin = await requireAdmin();
  const groupId = str(formData, "groupId");
  const archived = str(formData, "archived") === "true";
  const repo = getRepo();
  await repo.updateGroup(groupId, { archived });
  await repo.addAudit({ actorId: admin.id, action: archived ? "group.archive" : "group.unarchive", target: groupId, details: {} });
  refreshAll();
}

/** Add members by ticking names and/or pasting emails (one per line or comma-separated). */
export async function addGroupMembers(_prev: FormState, formData: FormData): Promise<FormState> {
  const groupId = str(formData, "groupId");
  const staff = await requireGroupManager(groupId);
  const repo = getRepo();
  const [profiles, members] = await Promise.all([repo.listProfiles(), repo.listGroupMembers(groupId)]);
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  const ids = new Set(formData.getAll("userId").map(String));
  const unknown: string[] = [];
  for (const email of str(formData, "emails").split(/[\s,;]+/).map((e) => e.toLowerCase()).filter(Boolean)) {
    const p = byEmail.get(email);
    if (p) ids.add(p.id); else unknown.push(email);
  }
  const existing = new Set(members.map((m) => m.userId));
  const known = new Set(profiles.map((p) => p.id));
  const toAdd = [...ids].filter((id) => !existing.has(id) && known.has(id));
  await Promise.all(toAdd.map((id) => repo.setGroupMember(groupId, id, "member")));
  if (toAdd.length) await repo.addAudit({ actorId: staff.user.id, action: "group.add_members", target: groupId, details: { count: toAdd.length } });
  refreshAll();
  const msg = `Added ${toAdd.length} member(s).`;
  return unknown.length
    ? { error: `${msg} Not found (they must sign in to the app once first): ${unknown.join(", ")}` }
    : { ok: msg };
}

export async function setGroupRole(formData: FormData) {
  const admin = await requireAdmin(); // only admins appoint leads
  const groupId = str(formData, "groupId");
  const userId = str(formData, "userId");
  const parsedRole = z.enum(["member", "lead"]).safeParse(str(formData, "role"));
  if (!parsedRole.success) return;
  const role = parsedRole.data;
  const repo = getRepo();
  await repo.setGroupMember(groupId, userId, role);
  await repo.addAudit({ actorId: admin.id, action: "group.set_role", target: userId, details: { groupId, role } });
  refreshAll();
}

export async function removeGroupMember(formData: FormData) {
  const groupId = str(formData, "groupId");
  const staff = await requireGroupManager(groupId);
  const userId = str(formData, "userId");
  const repo = getRepo();
  const member = (await repo.listGroupMembers(groupId)).find((m) => m.userId === userId);
  // Leads can't remove other leads (or themselves); admins can.
  if (!member || (member.role === "lead" && !staff.isAdmin)) return;
  await repo.removeGroupMember(groupId, userId);
  await repo.addAudit({ actorId: staff.user.id, action: "group.remove_member", target: userId, details: { groupId } });
  refreshAll();
}

/** Admins (or the group's leads) record an excuse for a member, e.g. one sent by message. It is approved straight away. */
export async function addExcuseForMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const meetingId = str(formData, "meetingId");
  const userId = str(formData, "userId");
  const reason = str(formData, "reason").slice(0, 500);
  if (!meetingId || !userId) return { error: "Pick a meeting and a member." };
  if (reason.length < 3) return { error: "Add a short reason." };
  const { actorId, meeting } = await requireMeetingManager(meetingId);
  const repo = getRepo();
  const [expected, record, [existing]] = await Promise.all([
    expectedMembers(repo, meeting), repo.getAttendance(meetingId, userId), repo.listExcuses({ userId, meetingId }),
  ]);
  if (!expected.some((p) => p.id === userId)) {
    return { error: "That member isn't expected at this meeting." };
  }
  if (record && record.status !== "absent" && record.status !== "excused") {
    return { error: `They are already marked ${record.status} for this meeting.` };
  }
  const excuseId = existing?.id ?? (await repo.createExcuse({ meetingId, userId, reason })).id;
  await repo.setExcuseStatus(excuseId, "approved", actorId);
  await applyApprovedExcuse(repo, meetingId, userId);
  await repo.addAudit({ actorId, action: "excuse.added_by_admin", target: userId, details: { meetingId, reason } });
  refreshAll();
  return { ok: "Excuse added and approved." };
}

export async function deleteGroup(formData: FormData) {
  const admin = await requireAdmin();
  const groupId = str(formData, "groupId");
  const repo = getRepo();
  const group = await repo.getGroup(groupId);
  if (!group) redirect("/admin/groups");
  await repo.deleteGroup(groupId);
  await repo.addAudit({ actorId: admin.id, action: "group.delete", target: groupId, details: { name: group.name } });
  refreshAll();
  redirect("/admin/groups");
}

export async function deleteMember(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  if (!userId || userId === admin.id) return; // admins can't delete themselves
  const repo = getRepo();
  const profile = await repo.getProfile(userId);
  if (!profile) return;
  await repo.deleteMember(userId);
  await repo.addAudit({ actorId: admin.id, action: "member.delete", target: null, details: { name: profile.name, email: profile.email } });
  refreshAll();
}

/** Remove someone who was added but never signed in. */
export async function deleteRosterEntry(formData: FormData) {
  const admin = await requireAdmin();
  const email = str(formData, "email").toLowerCase();
  if (!email) return;
  const repo = getRepo();
  if ((await repo.listProfiles()).some((p) => p.email === email)) return; // signed-up members go through deleteMember
  await repo.deleteRosterEntry(email);
  await repo.addAudit({ actorId: admin.id, action: "roster.delete", target: null, details: { email } });
  refreshAll();
}
