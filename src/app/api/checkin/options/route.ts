import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { verifyToken } from "@/lib/qr-token";
import { getRepo } from "@/lib/repo";
import { authenticationOptions, setChallengeCookie } from "@/lib/webauthn";

const Body = z.object({ meetingId: z.string().min(1), token: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid QR code." }, { status: 400 });

  const repo = getRepo();
  const meeting = await repo.getMeeting(body.data.meetingId);
  if (!meeting || meeting.status !== "live") return NextResponse.json({ error: "This meeting is not open for check-in." }, { status: 400 });
  if (!verifyToken(meeting.id, meeting.qrSecret, body.data.token)) {
    return NextResponse.json({ error: "QR code expired. Scan the code on the screen again." }, { status: 400 });
  }
  const existing = (await repo.listAttendanceForMeeting(meeting.id)).find((a) => a.userId === user.id);
  if (existing) return NextResponse.json({ alreadyCheckedIn: true, status: existing.status });

  const passkey = await repo.getPasskeyByUser(user.id);
  if (!passkey) return NextResponse.json({ error: "Register your phone first.", needsOnboarding: true }, { status: 400 });

  const options = await authenticationOptions(passkey);
  const res = NextResponse.json({ options, meetingTitle: meeting.title });
  setChallengeCookie(res, { challenge: options.challenge, userId: user.id, purpose: "checkin", meetingId: meeting.id });
  return res;
}
