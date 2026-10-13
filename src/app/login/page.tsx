import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { env } from "@/lib/env";
import { getRepo } from "@/lib/repo";
import { GoogleButton } from "./google-button";

const errors: Record<string, string> = {
  not_on_roster: "That account isn't on the E-Cell members list. Use your college email, or ask a core member to add you.",
  inactive: "Your membership is inactive. Contact the core team.",
  auth_failed: "Sign-in failed. Please try again.",
  missing_code: "Sign-in failed. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next);
  const demoUsers = env.backend === "memory" ? await getRepo().listProfiles() : [];

  return (
    <div className="mx-auto max-w-sm space-y-4 pt-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="muted text-sm">Use your college Google account. You&apos;ll register your phone once, then check in at meetings by scanning the QR on screen.</p>
      {error && <p className="rounded-lg bg-red-100 p-3 text-sm text-red-800">{errors[error] ?? "Something went wrong."}</p>}
      {env.backend === "memory" ? (
        <div className="card space-y-2">
          <p className="text-sm font-semibold">Demo mode: pick a user</p>
          {demoUsers.map((u) => (
            <form key={u.id} action="/api/dev/login" method="post">
              <input type="hidden" name="userId" value={u.id} />
              <input type="hidden" name="next" value={next} />
              <button className="btn-ghost w-full justify-between">{u.name} <span className="muted text-xs">{u.role}</span></button>
            </form>
          ))}
        </div>
      ) : (
        <GoogleButton next={next} domain={env.allowedEmailDomain} />
      )}
    </div>
  );
}
