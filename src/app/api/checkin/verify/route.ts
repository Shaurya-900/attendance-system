import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DEVICE_COOKIE, newDeviceId, setDeviceCookie } from "@/lib/device";
import { clock, stampDate } from "@/lib/format";
import { getRepo } from "@/lib/repo";
import { statusForCheckIn } from "@/lib/strikes";
import { CHALLENGE_COOKIE, clearChallengeCookie, readChallenge, verifyAuthentication } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const state = readChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value);
  if (!state || state.purpose !== "checkin" || state.userId !== user.id || !state.meetingId) {
    return NextResponse.json({ error: "Check-in timed out. Scan the QR code again." }, { status: 400 });
  }

  const repo = getRepo();
  const [meeting, passkey] = await Promise.all([repo.getMeeting(state.meetingId), repo.getPasskeyByUser(user.id)]);
  if (!meeting || meeting.status !== "live") return NextResponse.json({ error: "Check-in for this meeting has closed.", next: "me" }, { status: 400 });
  if (!passkey) return NextResponse.json({ error: "Register your phone first.", next: "onboard" }, { status: 400 });

  let newCounter: number | null;
  try {
    newCounter = await verifyAuthentication(await req.json(), state.challenge, passkey);
  } catch {
    newCounter = null;
  }
  if (newCounter === null) {
    return NextResponse.json({ error: "Your fingerprint check didn't match this phone's registration. Tap Check in to try again." }, { status: 400 });
  }

  const flags: string[] = [];
  let deviceId = req.cookies.get(DEVICE_COOKIE)?.value;
  if (!deviceId) {
    deviceId = newDeviceId();
    flags.push("new_device");
  }
  if (deviceId !== passkey.deviceId) flags.push("device_mismatch");

  // Decided by when they scanned, so the status the screen showed before the tap is the one they get.
  const status = statusForCheckIn(meeting.startsAt, meeting.graceMinutes, state.scannedAt ?? Date.now());
  const checkedInAt = new Date().toISOString();
  const result = await repo.insertAttendance({
    meetingId: meeting.id, userId: user.id, status, checkedInAt,
    credentialId: passkey.credentialId, deviceId, source: "qr", flags,
  });

  if (result === "duplicate_device") {
    await repo.addAudit({ actorId: user.id, action: "proxy.duplicate_device", target: meeting.id, details: { deviceId } });
    return NextResponse.json({ error: "This phone already checked someone else in to this meeting. Each phone checks in one member, so use your own registered phone.", next: "me" }, { status: 409 });
  }
  if (result === "ok") {
    await repo.updatePasskeyCounter(passkey.credentialId, newCounter);
    // Scanning a live group code brings you into the group (advisors have no attendance duties, so they just check in).
    if (meeting.groupId && user.role !== "advisor" && !(await repo.listMembershipsForUser(user.id)).some((m) => m.groupId === meeting.groupId)) {
      await repo.setGroupMember(meeting.groupId, user.id, "member");
      await repo.addAudit({ actorId: user.id, action: "group.auto_join", target: meeting.groupId, details: { meetingId: meeting.id } });
    }
  }
  const res = NextResponse.json(result === "duplicate_user" ? { alreadyCheckedIn: true } : { ok: true, status, meetingTitle: meeting.title, clock: clock(checkedInAt), date: stampDate(checkedInAt) });
  setDeviceCookie(res, deviceId);
  clearChallengeCookie(res);
  return res;
}
