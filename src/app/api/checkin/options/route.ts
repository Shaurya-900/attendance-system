import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { readScanTicketDetails } from "@/lib/scan-ticket";
import { authenticationOptions, setChallengeCookie } from "@/lib/webauthn";

const Body = z.object({ ticket: z.string().min(1) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  // `next` tells the page what to offer when tapping Check in again can't help.
  if (!body.success) return NextResponse.json({ error: "That isn't a check-in code. Scan the code on the screen again.", next: "rescan" }, { status: 400 });
  const scan = readScanTicketDetails(body.data.ticket, user.id);
  if (!scan) return NextResponse.json({ error: "Too much time has passed since you scanned. Scan the code on the screen again.", next: "rescan" }, { status: 400 });
  const { meetingId, scannedAt } = scan;

  const repo = getRepo();
  const meeting = await repo.getMeeting(meetingId);
  if (!meeting || meeting.status !== "live") return NextResponse.json({ error: "Check-in for this meeting has closed.", next: "me" }, { status: 400 });
  // Everyone scans at once at the start of a meeting, so keep this to one parallel round of small queries.
  const [existing, passkey] = await Promise.all([repo.getAttendance(meeting.id, user.id), repo.getPasskeyByUser(user.id)]);
  // An absence or excuse doesn't count as checked in: the member can still check in and replace it.
  if (existing && (existing.status === "present" || existing.status === "late")) return NextResponse.json({ alreadyCheckedIn: true, status: existing.status });
  if (!passkey) return NextResponse.json({ error: "Register your phone first.", next: "onboard" }, { status: 400 });

  const options = await authenticationOptions(passkey);
  const res = NextResponse.json({ options, meetingTitle: meeting.title });
  setChallengeCookie(res, { challenge: options.challenge, userId: user.id, purpose: "checkin", meetingId: meeting.id, scannedAt });
  return res;
}
