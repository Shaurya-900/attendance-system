"use server";

import { revalidatePath } from "next/cache";

/** Clear every cached page: one change can affect lists, dropdowns and strike counts elsewhere. */
function refreshAll() {
  revalidatePath("/", "layout");
}
import { requireUser } from "@/lib/auth";
import { EXCUSE_WINDOW_MS } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";

export type ExcuseState = { error?: string; ok?: string } | null;

export async function requestExcuse(_prev: ExcuseState, formData: FormData): Promise<ExcuseState> {
  const user = await requireUser();
  const meetingId = String(formData.get("meetingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!meetingId) return { error: "Pick a meeting." };
  if (reason.length < 5) return { error: "Please give a reason (at least 5 characters)." };
  const repo = getRepo();
  const meeting = await repo.getMeeting(meetingId);
  if (!meeting) return { error: "That meeting no longer exists." };
  if (Date.now() > new Date(meeting.startsAt).getTime() + EXCUSE_WINDOW_MS) return { error: "Excuses close 24 hours after the meeting starts." };
  const [memberships, attended, excuses] = await Promise.all([
    meeting.groupId ? repo.listMembershipsForUser(user.id) : [],
    repo.getAttendance(meetingId, user.id),
    repo.listExcuses({ userId: user.id, meetingId }),
  ]);
  if (meeting.groupId && !memberships.some((m) => m.groupId === meeting.groupId)) {
    return { error: "You're not in the group this meeting is for." };
  }
  if (attended && attended.status !== "absent") return { error: "You don't need an excuse for this meeting." };
  if (excuses.length > 0) return { error: "You've already sent an excuse for this meeting." };
  await repo.createExcuse({ meetingId, userId: user.id, reason });
  refreshAll();
  return { ok: "Excuse sent. An admin will review it." };
}
