import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { clock, stampDate } from "@/lib/format";
import { verifyToken } from "@/lib/qr-token";
import { getRepo } from "@/lib/repo";
import { makeScanTicket } from "@/lib/scan-ticket";
import { statusForCheckIn } from "@/lib/strikes";
import { CheckIn } from "./check-in";
import { Receipt } from "./receipt";

/** A dead end turned into a next step: what happened, what to do, and a way out. */
function Notice({ title, tone, children }: { title: string; tone?: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <div className="checkin">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p role={tone === "warn" ? "alert" : undefined} className={tone ? `alert alert-${tone}` : "muted"}>{children}</p>
      <Link href="/me" className="btn-ghost self-start">Go to my attendance</Link>
    </div>
  );
}

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ m?: string; t?: string; registered?: string }> }) {
  const { m, t, registered } = await searchParams;
  const here = `/checkin?m=${encodeURIComponent(m ?? "")}&t=${encodeURIComponent(t ?? "")}`;
  const user = await requireUser(here);
  const repo = getRepo();
  const [passkey, meeting, existing] = await Promise.all([
    repo.getPasskeyByUser(user.id), m ? repo.getMeeting(m) : null, m ? repo.getAttendance(m, user.id) : null,
  ]);
  // First scan ever: register the phone, then come back here and scan once more (the code will have moved on).
  if (!passkey) redirect(`/onboard?next=${encodeURIComponent(`/checkin?m=${encodeURIComponent(m ?? "")}&registered=1`)}`);

  if (registered && !t) {
    return (
      <Notice title="Phone registered" tone="ok">
        One more scan: point your camera at the code on the screen to check in{meeting ? ` to ${meeting.title}` : ""}.
      </Notice>
    );
  }
  if (!m) {
    return <Notice title="Scan the code to check in">Point your phone camera at the QR code on the screen at the meeting. It opens this page, ready to go.</Notice>;
  }
  if (!meeting) {
    return <Notice title="We couldn't find that meeting" tone="warn">This link doesn&apos;t match a meeting. Scan the code on the screen again.</Notice>;
  }
  // Already in the register: show the record straight away, no tap or fingerprint needed.
  if (existing?.checkedInAt && (existing.status === "present" || existing.status === "late")) {
    return <Receipt status={existing.status} title={meeting.title} name={user.name} clock={clock(existing.checkedInAt)} date={stampDate(existing.checkedInAt)} already />;
  }
  if (meeting.status === "scheduled") {
    return <Notice title="Check-in hasn't opened yet" tone="warn">Your lead opens check-in for {meeting.title} when the meeting starts. Scan the code once it&apos;s on the screen.</Notice>;
  }
  if (meeting.status === "closed") {
    return (
      <Notice title="Check-in has closed" tone="warn">
        Check-in for {meeting.title} is closed. Missed it for a good reason? Request an excuse from your attendance page within 24 hours of the start.
      </Notice>
    );
  }
  const [memberships, group] = meeting.groupId ? await Promise.all([repo.listMembershipsForUser(user.id), repo.getGroup(meeting.groupId)]) : [[], null];
  if (meeting.groupId && !memberships.some((g) => g.groupId === meeting.groupId)) {
    const groupName = group?.name ?? "one group";
    return <Notice title={`This one's for ${groupName}`} tone="warn">{meeting.title} is only for {groupName} members, so there&apos;s nothing to check in to.</Notice>;
  }
  // Check the code as soon as the page opens, so nobody confirms their fingerprint only to be told it expired.
  if (!t || !verifyToken(meeting.id, meeting.qrSecret, t)) {
    return <Notice title="That code has moved on" tone="warn">The code on the screen changes every 10 seconds. Scan it again to check in.</Notice>;
  }

  const late = statusForCheckIn(meeting.startsAt, meeting.graceMinutes) === "late";
  const started = new Date(meeting.startsAt).getTime() <= Date.now();
  return (
    <div className="checkin">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{meeting.title}</h1>
        <p className="muted">{group?.name ?? "Full body"} · {started ? "started" : "starts"} at {clock(meeting.startsAt)}</p>
      </div>
      {late && <p className="alert alert-warn">You&apos;re past the start, so this counts as late. Late doesn&apos;t add a strike.</p>}

      <div className="checkin-action space-y-3">
        <CheckIn ticket={makeScanTicket(meeting.id, user.id)} title={meeting.title} name={user.name} />
        <form action="/api/auth/logout" method="post" className="muted text-sm">
          Checking in as {user.name}. Tap, then confirm with your fingerprint or face.{" "}
          <button className="underline underline-offset-2">Not you?</button>
        </form>
        <details className="muted text-sm">
          <summary className="cursor-pointer underline-offset-2 hover:underline">No fingerprint prompt?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Use the phone you registered, with its screen lock turned on.</li>
            <li>Changed phones? Ask an admin to reset your registration, then register the new one.</li>
            <li>Still stuck? Tell your lead before the meeting ends so they can mark you in.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
