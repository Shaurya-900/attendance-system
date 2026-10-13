"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { applyApprovedExcuse, closeMeeting } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";
import type { AttendanceStatus, Role } from "@/lib/types";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createMeeting(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({
    title: z.string().min(1).max(120),
    startsAt: z.string().datetime({ offset: true }),
    graceMinutes: z.coerce.number().int().min(0).max(120),
  }).parse({ title: str(formData, "title"), startsAt: str(formData, "startsAt"), graceMinutes: str(formData, "graceMinutes") || 10 });
  const meeting = await getRepo().createMeeting({ ...input, createdBy: admin.id });
  redirect(`/admin/meetings/${meeting.id}`);
}

export async function startMeeting(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "meetingId");
  const repo = getRepo();
  const m = await repo.getMeeting(id);
  if (m?.status !== "scheduled") return;
  await repo.setMeetingStatus(id, "live");
  await repo.addAudit({ actorId: admin.id, action: "meeting.start", target: id, details: {} });
  redirect(`/admin/meetings/${id}/live`);
}

export async function endMeeting(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "meetingId");
  await closeMeeting(getRepo(), id, admin.id);
  revalidatePath(`/admin/meetings/${id}`);
  redirect(`/admin/meetings/${id}`);
}

export async function overrideAttendance(formData: FormData) {
  const admin = await requireAdmin();
  const meetingId = str(formData, "meetingId");
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
  await repo.addAudit({ actorId: admin.id, action: "attendance.override", target: userId, details: { meetingId, from: prev?.status ?? null, to: status, reason } });
  revalidatePath(`/admin/meetings/${meetingId}`);
}

export async function reviewExcuse(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "excuseId");
  const decision = z.enum(["approved", "rejected"]).parse(str(formData, "decision"));
  const repo = getRepo();
  const excuse = await repo.getExcuse(id);
  if (!excuse || excuse.status !== "pending") return;
  await repo.setExcuseStatus(id, decision, admin.id);
  if (decision === "approved") await applyApprovedExcuse(repo, excuse.meetingId, excuse.userId);
  await repo.addAudit({ actorId: admin.id, action: `excuse.${decision}`, target: excuse.userId, details: { meetingId: excuse.meetingId } });
  revalidatePath("/admin/excuses");
}

export async function adjustStrikes(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const points = z.coerce.number().min(-10).max(10).refine((n) => n !== 0).parse(str(formData, "points"));
  const reason = str(formData, "reason");
  if (!reason) return;
  const semesterId = str(formData, "semesterId") || null;
  const repo = getRepo();
  await repo.addAdjustment({ userId, semesterId, points, reason, createdBy: admin.id });
  await repo.addAudit({ actorId: admin.id, action: "strikes.adjust", target: userId, details: { points, reason, semesterId } });
  revalidatePath("/admin/members");
}

export async function resetPasskey(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const repo = getRepo();
  await repo.deletePasskey(userId);
  await repo.addAudit({ actorId: admin.id, action: "passkey.reset", target: userId, details: {} });
  revalidatePath("/admin/members");
}

export async function setActive(formData: FormData) {
  const admin = await requireAdmin();
  const userId = str(formData, "userId");
  const active = str(formData, "active") === "true";
  if (userId === admin.id) return;
  const repo = getRepo();
  await repo.setProfileActive(userId, active);
  await repo.addAudit({ actorId: admin.id, action: active ? "member.activate" : "member.deactivate", target: userId, details: {} });
  revalidatePath("/admin/members");
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
  await repo.addAudit({ actorId: admin.id, action: "roster.import", target: null, details: { count: entries.length } });
  revalidatePath("/admin/members");
}

export async function createSemester(formData: FormData) {
  const admin = await requireAdmin();
  const input = z.object({ name: z.string().min(1), startsOn: z.string().date(), endsOn: z.string().date() })
    .refine((s) => s.endsOn >= s.startsOn)
    .parse({ name: str(formData, "name"), startsOn: str(formData, "startsOn"), endsOn: str(formData, "endsOn") });
  const repo = getRepo();
  await repo.createSemester(input);
  await repo.addAudit({ actorId: admin.id, action: "semester.create", target: null, details: input });
  revalidatePath("/admin");
}

export async function deleteSemester(formData: FormData) {
  const admin = await requireAdmin();
  const id = str(formData, "semesterId");
  const repo = getRepo();
  const semester = (await repo.listSemesters()).find((s) => s.id === id);
  if (!semester) return;
  await repo.deleteSemester(id);
  await repo.addAudit({ actorId: admin.id, action: "semester.delete", target: id, details: { name: semester.name, startsOn: semester.startsOn, endsOn: semester.endsOn } });
  revalidatePath("/admin");
}
