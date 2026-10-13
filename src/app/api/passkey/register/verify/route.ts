import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DEVICE_COOKIE, newDeviceId, setDeviceCookie } from "@/lib/device";
import { getRepo } from "@/lib/repo";
import { CHALLENGE_COOKIE, clearChallengeCookie, readChallenge, verifyRegistration } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const state = readChallenge(req.cookies.get(CHALLENGE_COOKIE)?.value);
  if (!state || state.purpose !== "register" || state.userId !== user.id) {
    return NextResponse.json({ error: "Registration timed out. Try again." }, { status: 400 });
  }

  const repo = getRepo();
  if (await repo.getPasskeyByUser(user.id)) {
    return NextResponse.json({ error: "A phone is already registered for your account." }, { status: 409 });
  }

  const deviceId = req.cookies.get(DEVICE_COOKIE)?.value ?? newDeviceId();
  const others = (await repo.getPasskeysByDevice(deviceId)).filter((p) => p.userId !== user.id);
  if (others.length > 0) {
    await repo.addAudit({ actorId: user.id, action: "proxy.register_shared_device", target: user.id, details: { otherUserIds: others.map((o) => o.userId) } });
    return NextResponse.json({ error: "This phone is already registered to another member. Each member must use their own phone." }, { status: 409 });
  }

  let verified;
  try {
    verified = await verifyRegistration(await req.json(), state.challenge);
  } catch (e) {
    return NextResponse.json({ error: `Could not verify passkey: ${(e as Error).message}` }, { status: 400 });
  }
  if (!verified) return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });

  await repo.insertPasskey({ userId: user.id, ...verified, deviceId });
  await repo.addAudit({ actorId: user.id, action: "passkey.register", target: user.id, details: {} });
  const res = NextResponse.json({ ok: true });
  setDeviceCookie(res, deviceId);
  clearChallengeCookie(res);
  return res;
}
