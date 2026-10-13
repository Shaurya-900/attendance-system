"use server";

import { revalidatePath } from "next/cache";

/** Clear every cached page: one change can affect lists, dropdowns and strike counts elsewhere. */
function refreshAll() {
  revalidatePath("/", "layout");
}
import { redirect } from "next/navigation";
import { z } from "zod";
import { canManageGroup, requireAdmin, requireStaff } from "@/lib/auth";
import { applyApprovedExcuse, closeMeeting } from "@/lib/meetings";
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

export async function createMeeting(formData: FormData) {
  const staff = await requireStaff();
  const groupId = str(formData, "groupId") || null;
  if (!canManageGroup(staff, groupId)) redirect("/admin/meetings");
  const input = z.object({
    title: z.string().min(1).max(120),
    startsAt: z.string().datetime({ offset: true }),
    graceMinutes: z.coerce.number().int().min(0).max(120),
  }).parse({ title: str(formData, "title"), startsAt: str(formData, "startsAt"), graceMinutes: str(formData, "graceMinutes") || 10 });
  const meeting = await getRepo().createMeeting({ ...input, groupId, createdBy: staff.user.id });
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

export async function endMeeting(formData: FormData) {
  const id = str(formData, "meetingId");
  const { actorId } = await requireMeetingManager(id);
  await closeMeeting(getRepo(), id, actorId);
  refreshAll();
  redirect(`/admin/meetings/${id}`);
}

export async function overrideAttendance(formData: FormData) {
  const meetingId = str(formData, "meetingId");
  const { actorId } = await requireMeetingManager(meetingId);
  const userId = str(formData, "userId");
  const status = z.enum(["present", "late", "absent", "excused"]).parse(str(formData, "status")) as AttendanceStatus;
  const reason = str(formData, "reason");
  if (!reason) return;
  const repo = getRepo();
  const prev = (await repo.listAttendanceForMeeting(meetingId)).find((a) => a.userId === userId);
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
  const decision = z.enum(["approved", "rejected"]).parse(str(formData, "decision"));
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
  const points = z.coerce.number().min(-10).max(10).refine((n) => n !== 0).parse(str(formData, "points"));
  const reason = str(formData, "reason");
  if (!reason) return;
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

/** CSV lines: email,name,roll_no[,role] — header row optional. */
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
  for (const p of await repo.listProfiles()) {
    const e = byEmail.get(p.email);
    if (!e || p.id === admin.id) continue;
    if (e.name !== p.name || e.rollNo !== p.rollNo || e.role !== p.role) {
      await repo.upsertProfile({ ...p, name: e.name, rollNo: e.rollNo, role: e.role });
    }
  }
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
    kind: z.enum(["team", "committee", "leads", "event"]),
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
  const profiles = await repo.listProfiles();
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  const ids = new Set(formData.getAll("userId").map(String));
  const unknown: string[] = [];
  for (const email of str(formData, "emails").split(/[\s,;]+/).map((e) => e.toLowerCase()).filter(Boolean)) {
    const p = byEmail.get(email);
    if (p) ids.add(p.id); else unknown.push(email);
  }
  const existing = new Set((await repo.listGroupMembers(groupId)).map((m) => m.userId));
  const toAdd = [...ids].filter((id) => !existing.has(id) && profiles.some((p) => p.id === id));
  for (const id of toAdd) await repo.setGroupMember(groupId, id, "member");
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
  const role = z.enum(["member", "lead"]).parse(str(formData, "role"));
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
