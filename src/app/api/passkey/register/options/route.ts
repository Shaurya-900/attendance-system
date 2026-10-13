import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { registrationOptions, setChallengeCookie } from "@/lib/webauthn";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (await getRepo().getPasskeyByUser(user.id)) {
    return NextResponse.json({ error: "A phone is already registered for your account. Ask an admin to reset it." }, { status: 409 });
  }
  const options = await registrationOptions(user);
  const res = NextResponse.json(options);
  setChallengeCookie(res, { challenge: options.challenge, userId: user.id, purpose: "register" });
  return res;
}
