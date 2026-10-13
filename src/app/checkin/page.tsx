import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { CheckIn } from "./check-in";

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ m?: string; t?: string }> }) {
  const { m, t } = await searchParams;
  const here = `/checkin?m=${encodeURIComponent(m ?? "")}&t=${encodeURIComponent(t ?? "")}`;
  const user = await requireUser(here);
  if (!(await getRepo().getPasskeyByUser(user.id))) redirect(`/onboard?next=${encodeURIComponent("/me")}`);
  if (!m || !t) return <p className="card">Scan the QR code shown on the screen at the meeting.</p>;
  return (
    <div className="mx-auto max-w-md space-y-4 pt-4">
      <h1 className="text-2xl font-bold">Check in</h1>
      <p className="muted text-sm">Signed in as {user.name}. Tap below and confirm with your fingerprint / face.</p>
      <CheckIn meetingId={m} token={t} />
    </div>
  );
}
