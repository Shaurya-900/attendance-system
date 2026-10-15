import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { verifyToken } from "@/lib/qr-token";
import { getRepo } from "@/lib/repo";
import { makeScanTicket } from "@/lib/scan-ticket";
import { CheckIn } from "./check-in";

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ m?: string; t?: string }> }) {
  const { m, t } = await searchParams;
  const here = `/checkin?m=${encodeURIComponent(m ?? "")}&t=${encodeURIComponent(t ?? "")}`;
  const user = await requireUser(here);
  const repo = getRepo();
  const [passkey, meeting] = await Promise.all([repo.getPasskeyByUser(user.id), m ? repo.getMeeting(m) : null]);
  if (!passkey) redirect(`/onboard?next=${encodeURIComponent("/me")}`);
  if (!m || !t) return <p className="card">Scan the QR code shown on the screen at the meeting.</p>;
  // Check the code as soon as the page opens, so nobody confirms their fingerprint only to be told it expired.
  if (!meeting || meeting.status !== "live") {
    return <p role="alert" className="card">This meeting is not open for check-in.</p>;
  }
  if (!verifyToken(meeting.id, meeting.qrSecret, t)) {
    return <p role="alert" className="card">This QR code has expired. Scan the code on the screen again.</p>;
  }
  return (
    <div className="mx-auto max-w-md space-y-4 pt-4">
      <h1 className="text-2xl font-bold">Check in</h1>
      <p className="muted text-sm">Signed in as {user.name}. Tap below and confirm with your fingerprint / face.</p>
      <CheckIn ticket={makeScanTicket(meeting.id, user.id)} />
    </div>
  );
}
