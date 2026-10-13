"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { EXCUSE_WINDOW_MS } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";


export async function requestExcuse(formData: FormData) {
  const user = await requireUser();
  const meetingId = String(formData.get("meetingId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  if (!meetingId || reason.length < 5) return;
  const repo = getRepo();
  const meeting = await repo.getMeeting(meetingId);
  if (!meeting || Date.now() > new Date(meeting.startsAt).getTime() + EXCUSE_WINDOW_MS) return;
  const attended = (await repo.listAttendanceForUser(user.id)).find((a) => a.meetingId === meetingId);
  if (attended && attended.status !== "absent") return;
  if ((await repo.listExcuses({ userId: user.id })).some((e) => e.meetingId === meetingId)) return;
  await repo.createExcuse({ meetingId, userId: user.id, reason });
  revalidatePath("/me");
}
