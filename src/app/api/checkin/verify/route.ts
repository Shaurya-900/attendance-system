import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DEVICE_COOKIE, newDeviceId, setDeviceCookie } from "@/lib/device";
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
  if (!meeting || meeting.status !== "live") return NextResponse.json({ error: "This meeting is no longer open." }, { status: 400 });
  if (!passkey) return NextResponse.json({ error: "Register your phone first." }, { status: 400 });

  let newCounter: number | null;
  try {
    newCounter = await verifyAuthentication(await req.json(), state.challenge, passkey);
  } catch (e) {
    return NextResponse.json({ error: `Passkey check failed: ${(e as Error).message}` }, { status: 400 });
  }
  if (newCounter === null) return NextResponse.json({ error: "Passkey check failed." }, { status: 400 });
  await repo.updatePasskeyCounter(passkey.credentialId, newCounter);

  const flags: string[] = [];
  let deviceId = req.cookies.get(DEVICE_COOKIE)?.value;
  if (!deviceId) {
    deviceId = newDeviceId();
    flags.push("new_device");
  }
  if (deviceId !== passkey.deviceId) flags.push("device_mismatch");

  const status = statusForCheckIn(meeting.startsAt, meeting.graceMinutes);
  const result = await repo.insertAttendance({
    meetingId: meeting.id, userId: user.id, status, checkedInAt: new Date().toISOString(),
    credentialId: passkey.credentialId, deviceId, source: "qr", flags,
  });

  if (result === "duplicate_device") {
    await repo.addAudit({ actorId: user.id, action: "proxy.duplicate_device", target: meeting.id, details: { deviceId } });
    return NextResponse.json({ error: "This phone was already used to check in someone else. Proxy attempts are reported to the core team." }, { status: 409 });
  }
  const res = NextResponse.json(result === "duplicate_user" ? { alreadyCheckedIn: true } : { ok: true, status, meetingTitle: meeting.title });
  setDeviceCookie(res, deviceId);
  clearChallengeCookie(res);
  return res;
}
