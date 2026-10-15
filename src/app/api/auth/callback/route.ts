import { NextResponse, type NextRequest } from "next/server";
import { emailDomainAllowed, safeNext } from "@/lib/auth";
import { backfillAbsences } from "@/lib/meetings";
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
  // Removed from the roster = no access (admins excepted, so nobody locks themselves out).
  if (!emailDomainAllowed(email) || (!roster && existing?.role !== "admin")) {
    await supabase.auth.signOut();
    return fail("not_on_roster");
  }
  if (existing && !existing.active) {
    await supabase.auth.signOut();
    return fail("inactive");
  }
  const [passkey] = await Promise.all([
    repo.getPasskeyByUser(data.user.id),
    !existing && (async () => {
      await repo.upsertProfile({ id: data.user.id, email, name: roster!.name, rollNo: roster!.rollNo, role: roster!.role, active: true });
      if (roster!.role === "member" && roster!.addedAt) await backfillAbsences(repo, data.user.id, roster!.addedAt);
    })(),
  ]);
  return NextResponse.redirect(new URL(passkey ? next : `/onboard?next=${encodeURIComponent(next)}`, url.origin));
}
