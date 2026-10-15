import { redirect } from "next/navigation";
import { requireUser, safeNext } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { RegisterPasskey } from "./register-passkey";

export default async function OnboardPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const user = await requireUser("/onboard");
  if (await getRepo().getPasskeyByUser(user.id)) redirect(next);
  return (
    <div className="mx-auto max-w-md space-y-4 pt-4">
      <h1 className="text-2xl font-bold">Register your phone</h1>
      <div className="card space-y-3 text-sm">
        <p>Do this <strong>on your own phone</strong>. Your fingerprint / face / screen lock creates a passkey that only this phone holds.</p>
        <ul className="muted list-disc space-y-1 pl-5">
          <li>Every check-in needs this phone and your unlock, so sharing your password won&apos;t let anyone check in for you.</li>
          <li>One phone per member. A phone already registered to someone else will be refused.</li>
          <li>Changed phones? Ask an admin to reset your registration.</li>
        </ul>
      </div>
      {next.startsWith("/checkin") && <p className="alert alert-ok">After this, scan the code on the screen once more to check in. It changes every 10 seconds.</p>}
      <RegisterPasskey next={next} />
    </div>
  );
}
