"use server";

import { revalidatePath } from "next/cache";
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
  const attended = (await repo.listAttendanceForUser(user.id)).find((a) => a.meetingId === meetingId);
  if (attended && attended.status !== "absent") return { error: "You don't need an excuse for this meeting." };
  if ((await repo.listExcuses({ userId: user.id })).some((e) => e.meetingId === meetingId)) return { error: "You've already sent an excuse for this meeting." };
  await repo.createExcuse({ meetingId, userId: user.id, reason });
  revalidatePath("/me");
  return { ok: "Excuse sent. An admin will review it." };
}
