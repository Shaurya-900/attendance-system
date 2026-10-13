import { NextResponse, type NextRequest } from "next/server";
import { emailDomainAllowed, safeNext } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { createSessionClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const fail = (error: string) => NextResponse.redirect(new URL(`/login?error=${error}`, url.origin));
  if (!code) return fail("missing_code");

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  const email = data.user?.email?.toLowerCase();
  if (error || !data.user || !email) return fail("auth_failed");

  const repo = getRepo();
  const [roster, existing] = await Promise.all([repo.getRosterEntry(email), repo.getProfile(data.user.id)]);
  if (!emailDomainAllowed(email) || (!roster && !existing)) {
    await supabase.auth.signOut();
    return fail("not_on_roster");
  }
  if (existing && !existing.active) {
    await supabase.auth.signOut();
    return fail("inactive");
  }
  if (!existing) {
    await repo.upsertProfile({ id: data.user.id, email, name: roster!.name, rollNo: roster!.rollNo, role: roster!.role, active: true });
  }
  const passkey = await repo.getPasskeyByUser(data.user.id);
  return NextResponse.redirect(new URL(passkey ? next : `/onboard?next=${encodeURIComponent(next)}`, url.origin));
}
