import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { readScanTicket } from "@/lib/scan-ticket";
import { authenticationOptions, setChallengeCookie } from "@/lib/webauthn";

const Body = z.object({ ticket: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid QR code." }, { status: 400 });
  const meetingId = readScanTicket(body.data.ticket, user.id);
  if (!meetingId) return NextResponse.json({ error: "Too much time has passed. Scan the code on the screen again." }, { status: 400 });

  const repo = getRepo();
  const meeting = await repo.getMeeting(meetingId);
  if (!meeting || meeting.status !== "live") return NextResponse.json({ error: "This meeting is not open for check-in." }, { status: 400 });
  // Everyone scans at once at the start of a meeting, so keep this to one parallel round of small queries.
  const [memberships, existing, passkey] = await Promise.all([
    meeting.groupId ? repo.listMembershipsForUser(user.id) : [],
    repo.getAttendance(meeting.id, user.id),
    repo.getPasskeyByUser(user.id),
  ]);
  if (meeting.groupId && !memberships.some((m) => m.groupId === meeting.groupId)) {
    const group = await repo.getGroup(meeting.groupId);
    return NextResponse.json({ error: `This meeting is only for ${group?.name ?? "a specific group"}.` }, { status: 403 });
  }
  // An absence or excuse doesn't count as checked in: the member can still check in and replace it.
  if (existing && (existing.status === "present" || existing.status === "late")) return NextResponse.json({ alreadyCheckedIn: true, status: existing.status });
  if (!passkey) return NextResponse.json({ error: "Register your phone first.", needsOnboarding: true }, { status: 400 });

  const options = await authenticationOptions(passkey);
  const res = NextResponse.json({ options, meetingTitle: meeting.title });
  setChallengeCookie(res, { challenge: options.challenge, userId: user.id, purpose: "checkin", meetingId: meeting.id });
  return res;
}
