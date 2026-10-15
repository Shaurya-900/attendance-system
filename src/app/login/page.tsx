import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { env } from "@/lib/env";
import { getRepo } from "@/lib/repo";
import logo from "../icon.png";
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
    <div className="mx-auto max-w-sm space-y-6 pt-6 sm:pt-12">
      <div className="space-y-3">
        <Image src={logo} alt="E-Cell" width={56} height={56} priority />
        <h1 className="text-4xl font-extrabold leading-[1.05]">Three strikes.<br />No proxies.</h1>
        <p className="muted">Sign in with your college Google account to check in at E-Cell meetings and see where you stand.</p>
      </div>
      <ol className="space-y-2 border-l-2 pl-4 text-sm" style={{ borderColor: "var(--border)" }}>
        <li><strong>Once:</strong> register your phone with your fingerprint or face.</li>
        <li><strong>At each meeting:</strong> scan the QR code on the screen.</li>
        <li><strong>Confirm</strong> with your fingerprint. You&apos;re marked present.</li>
      </ol>
      {error && <p role="alert" className="alert alert-error">{errors[error] ?? "Something went wrong."}</p>}
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
