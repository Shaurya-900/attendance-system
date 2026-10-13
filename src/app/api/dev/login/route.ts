import { NextResponse, type NextRequest } from "next/server";
import { DEV_USER_COOKIE, safeNext } from "@/lib/auth";
import { env } from "@/lib/env";
import { getRepo } from "@/lib/repo";

/** Demo-only sign-in for the in-memory backend. Disabled with the Supabase backend. */
export async function POST(req: NextRequest) {
  if (env.backend !== "memory") return new NextResponse("Not found", { status: 404 });
  const form = await req.formData();
  const profile = await getRepo().getProfile(String(form.get("userId")));
  if (!profile) return NextResponse.redirect(new URL("/login?error=auth_failed", req.url), 303);
  const passkey = await getRepo().getPasskeyByUser(profile.id);
  const next = safeNext(String(form.get("next") ?? ""));
  const res = NextResponse.redirect(new URL(passkey ? next : `/onboard?next=${encodeURIComponent(next)}`, req.url), 303);
  res.cookies.set(DEV_USER_COOKIE, profile.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
