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
import { env } from "@/lib/env";
import { applyMemberChanges, checkMemberChanges, detailsAfter } from "@/lib/members";
import { getRepo } from "@/lib/repo";
import { parseRoster } from "@/lib/roster";
import type { AttendanceStatus, Meeting, MemberChanges } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Admins manage every meeting; group leads only their own group's meetings. */
async function requireMeetingManager(meetingId: string): Promise<{ actorId: string; meeting: Meeting }> {
  const staff = await requireStaff();
  const meeting = await getRepo().getMeeting(meetingId);
  if (!meeting || !canManageGroup(staff, meeting.groupId)) redirect("/admin/meetings");
  return { actorId: staff.user.id, meeting };
}

/** Admins with approver rights: they approve other admins' member edits and appoint approvers. */
async function requireApprover() {
  const admin = await requireAdmin();
  if (!admin.approver) redirect("/admin/members");
  return admin;
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

export async function adjustStrikes(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const parsedPoints = z.coerce.number().min(-10).max(10).multipleOf(0.5).refine((n) => n !== 0).safeParse(str(formData, "points"));
  const reason = str(formData, "reason");
  const values = { points: str(formData, "points"), reason, groupId: str(formData, "groupId") };
  if (!parsedPoints.success) return { error: "Points must be between -10 and 10 in steps of 0.5, and not 0. Use a minus sign to remove strikes.", values };
  if (!reason) return { error: "Add a reason, so others can see why the count changed.", values };
  const points = parsedPoints.data;
  const semesterId = str(formData, "semesterId") || null;
  const groupId = str(formData, "groupId") || null;
  const repo = getRepo();
  await repo.addAdjustment({ userId, semesterId, groupId, points, reason, createdBy: admin.id });
  await repo.addAudit({ actorId: admin.id, action: "strikes.adjust", target: userId, details: { points, reason, semesterId, groupId } });
  refreshAll();
  return { ok: `${points > 0 ? "Added" : "Removed"} ${Math.abs(points)} ${Math.abs(points) === 1 ? "point" : "points"}.` };
}

export async function resetPasskey(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const repo = getRepo();
  await repo.deletePasskey(userId);
  await repo.addAudit({ actorId: admin.id, action: "passkey.reset", target: userId, details: {} });
  refreshAll();
  return { ok: "Phone reset. They'll register their phone again before their next check-in." };
}

export async function setActive(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const active = str(formData, "active") === "true";
  if (userId === admin.id) return { error: "You can't deactivate yourself." };
  const repo = getRepo();
  await repo.setProfileActive(userId, active);
  await repo.addAudit({ actorId: admin.id, action: active ? "member.activate" : "member.deactivate", target: userId, details: {} });
  refreshAll();
  return { ok: active ? "Reactivated. They can sign in and check in again." : "Deactivated. They can't sign in until reactivated." };
}

/** Roster lines (see parseRoster); a header row is optional. Valid lines are imported; bad ones are reported. */
export async function importRoster(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const repo = getRepo();
  const [current, profiles] = await Promise.all([repo.listRoster(), repo.listProfiles()]);
  const parsed = parseRoster(str(formData, "csv"), env.allowedEmailDomain, current);
  const { rejected, duplicates } = parsed;
  // Advisors are only set in the database; re-importing them from a sheet must not turn them into members.
  const advisors = new Set([...current, ...profiles].filter((p) => p.role === "advisor").map((p) => p.email));
  const entries = parsed.entries.map((e) => (advisors.has(e.email) ? { ...e, role: "advisor" as const } : e));
  const skipped = [
    rejected.length && `Skipped ${rejected.length} line(s). Each needs a name without numbers, a roll number of 10 digits starting with 2, and an SNU mail ID${env.allowedEmailDomain ? ` ending in @${env.allowedEmailDomain}` : ""}:\n${rejected.join("\n")}`,
    duplicates.length && `Skipped ${duplicates.length} duplicate(s): the SNU mail ID or roll number is repeated in this paste, or the roll number already belongs to someone else on the roster:\n${duplicates.join("\n")}`,
  ].filter(Boolean).join("\n\n");
  if (entries.length === 0) return { error: skipped || "Paste at least one line." };
  await repo.upsertRoster(entries);
  // Keep signed-up members in sync, so e.g. promoting someone to admin takes effect.
  const byEmail = new Map(entries.map((e) => [e.email, e]));
  await Promise.all(profiles.flatMap((p) => {
    const e = byEmail.get(p.email);
    if (!e || p.id === admin.id || (e.name === p.name && e.rollNo === p.rollNo && e.role === p.role)) return [];
    return [repo.upsertProfile({ ...p, name: e.name, rollNo: e.rollNo, role: e.role })];
  }));
  await repo.addAudit({ actorId: admin.id, action: "roster.import", target: null, details: { count: entries.length } });
  refreshAll();
  const msg = `Imported ${entries.length} member(s).`;
  return skipped ? { error: `${msg} ${skipped}` } : { ok: msg };
}

/** `values` sends typed fields back with an error, so the form can show them again. */
export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | null;

export async function createSemester(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z.object({ name: z.string().min(1), startsOn: z.string().date(), endsOn: z.string().date() })
    .safeParse({ name: str(formData, "name"), startsOn: str(formData, "startsOn"), endsOn: str(formData, "endsOn") });
  if (!parsed.success) return { error: "Fill in a name and both dates." };
  const input = parsed.data;
  if (input.endsOn < input.startsOn) return { error: "The end date is before the start date." };
  const repo = getRepo();
  const overlap = (await repo.listSemesters()).find((s) => s.startsOn <= input.endsOn && input.startsOn <= s.endsOn);
  if (overlap) return { error: `Overlaps with "${overlap.name}" (${overlap.startsOn} to ${overlap.endsOn}). Delete or adjust that one first.` };
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
  const [profiles, members, roster] = await Promise.all([repo.listProfiles(), repo.listGroupMembers(groupId), repo.listRoster()]);
  const byEmail = new Map(profiles.map((p) => [p.email, p]));
  const onRoster = new Set(roster.map((r) => r.email));
  const ids = new Set(formData.getAll("userId").map(String));
  // People on the roster who haven't signed in yet get a reserved place, and join on their first sign-in.
  const reserve = new Set(formData.getAll("email").map(String).filter((e) => onRoster.has(e) && !byEmail.has(e)));
  const unknown: string[] = [];
  for (const email of str(formData, "emails").split(/[\s,;]+/).map((e) => e.toLowerCase()).filter(Boolean)) {
    const p = byEmail.get(email);
    if (p) ids.add(p.id); else if (onRoster.has(email)) reserve.add(email); else unknown.push(email);
  }
  const existing = new Set(members.map((m) => m.userId));
  const known = new Set(profiles.map((p) => p.id));
  const toAdd = [...ids].filter((id) => !existing.has(id) && known.has(id));
  await Promise.all([
    ...toAdd.map((id) => repo.setGroupMember(groupId, id, "member")),
    ...[...reserve].map((email) => repo.addRosterGroup(email, groupId)),
  ]);
  if (toAdd.length || reserve.size) {
    await repo.addAudit({ actorId: staff.user.id, action: "group.add_members", target: groupId, details: { count: toAdd.length, reserved: reserve.size } });
  }
  refreshAll();
  const msg = `Added ${toAdd.length} member(s)${reserve.size ? `; ${reserve.size} more will join when they first sign in` : ""}.`;
  return unknown.length
    ? { error: `${msg} Not on the members list (import them on the Members page first): ${unknown.join(", ")}` }
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

/** Remove a reserved team place for someone who hasn't signed in yet. */
export async function removeReservedMember(formData: FormData) {
  const groupId = str(formData, "groupId");
  const staff = await requireGroupManager(groupId);
  const email = str(formData, "email");
  await getRepo().removeRosterGroup(email, groupId);
  await getRepo().addAudit({ actorId: staff.user.id, action: "group.unreserve", target: email, details: { groupId } });
  refreshAll();
}

/** An admin edits a member. Approvers' edits apply at once; other admins' edits wait for an approver. */
export async function requestMemberEdit(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const targetEmail = str(formData, "targetEmail");
  const parsedRole = z.enum(["member", "admin", "advisor"]).safeParse(str(formData, "role"));
  const role = parsedRole.success ? parsedRole.data : "member";
  const repo = getRepo();
  const checked = await checkMemberChanges(repo, targetEmail, {
    name: str(formData, "name"), rollNo: str(formData, "rollNo"), email: str(formData, "email"), role,
  }, { actorId: admin.id, domain: env.allowedEmailDomain });
  if ("error" in checked) {
    return { error: checked.error, values: { name: str(formData, "name"), rollNo: str(formData, "rollNo"), email: str(formData, "email") } };
  }
  if (admin.approver) {
    await applyMemberChanges(repo, targetEmail, checked.changes);
    await repo.addAudit({ actorId: admin.id, action: "member.edit", target: targetEmail, details: { ...checked.changes } });
    refreshAll();
    return { ok: "Saved." };
  }
  await repo.createMemberEdit({ targetEmail, changes: checked.changes, requestedBy: admin.id });
  await repo.addAudit({ actorId: admin.id, action: "member.edit_requested", target: targetEmail, details: { ...checked.changes } });
  refreshAll();
  return { ok: "Sent for approval. It applies once an approver accepts it." };
}

/** An approver accepts or rejects a pending member edit. The change is checked again, since the member may have changed since. */
export async function reviewMemberEdit(_prev: FormState, formData: FormData): Promise<FormState> {
  const approver = await requireApprover();
  const repo = getRepo();
  const edit = await repo.getMemberEdit(str(formData, "editId"));
  if (!edit || edit.status !== "pending") return { error: "This request was already handled." };
  if (str(formData, "decision") !== "approve") {
    await repo.setMemberEditStatus(edit.id, "rejected", approver.id);
    await repo.addAudit({ actorId: approver.id, action: "member.edit_rejected", target: edit.targetEmail, details: { editId: edit.id } });
    refreshAll();
    return { ok: "Rejected." };
  }
  const wanted = await detailsAfter(repo, edit.targetEmail, edit.changes);
  const checked: { changes: MemberChanges } | { error: string } = wanted
    ? await checkMemberChanges(repo, edit.targetEmail, wanted, { actorId: approver.id, domain: env.allowedEmailDomain })
    : { error: "That member no longer exists." };
  if ("error" in checked) return { error: `Can't approve: ${checked.error} Reject it, or ask for a new edit.` };
  await applyMemberChanges(repo, edit.targetEmail, checked.changes);
  await repo.setMemberEditStatus(edit.id, "approved", approver.id);
  await repo.addAudit({ actorId: approver.id, action: "member.edit_approved", target: edit.targetEmail, details: { editId: edit.id, ...checked.changes } });
  refreshAll();
  return { ok: "Approved and applied." };
}

/** Approvers appoint or remove other approvers. Only admins can be approvers, and nobody changes their own rights. */
export async function setApprover(_prev: FormState, formData: FormData): Promise<FormState> {
  const approver = await requireApprover();
  const repo = getRepo();
  const target = await repo.getProfile(str(formData, "userId"));
  if (!target || target.id === approver.id || target.role !== "admin") return { error: "Only other admins can be made approvers." };
  const value = str(formData, "approver") === "true";
  await repo.upsertProfile({ ...target, approver: value });
  await repo.addAudit({ actorId: approver.id, action: value ? "member.approver_added" : "member.approver_removed", target: target.email, details: {} });
  refreshAll();
  return { ok: value ? `${target.name} can now approve edits.` : `${target.name} can no longer approve edits.` };
}
