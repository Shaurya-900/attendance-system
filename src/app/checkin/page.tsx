import Link from "next/link";
import { redirect } from "next/navigation";
import { fmt } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { clock, stampDate } from "@/lib/format";
import { verifyToken } from "@/lib/qr-token";
import { getRepo } from "@/lib/repo";
import { makeScanTicket, readScanTicketDetails } from "@/lib/scan-ticket";
import { STRIKE_POINTS, statusForCheckIn } from "@/lib/strikes";
import type { AttendanceStatus } from "@/lib/types";
import { CheckIn } from "./check-in";
import { Receipt } from "./receipt";
import { ScanAgain } from "./scan-again";

/** The member's line in the register: name on the left, their mark (or the empty slot) on the right. */
function RegisterLine({ name, mark, status, label }: { name: string; mark: string; status: string; label: string }) {
  return (
    <div className="register-sheet" data-status={status} role="img" aria-label={label}>
      <div className="register-line" aria-hidden="true">
        <span className="truncate">{name}</span>
        <span className="register-slot">{mark}</span>
      </div>
    </div>
  );
}

/** A dead end turned into a next step: what happened, what to do, and the way on, low in thumb reach. */
function Notice({ title, tone, line, action = <Link href="/me" className="btn-ghost btn-tall w-full">Go to my attendance</Link>, children }: {
  title: string; tone?: "error"; line?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="checkin">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className={tone ? "alert alert-error" : "alert"}>{children}</p>
      {line}
      <div className="checkin-action space-y-3">{action}</div>
    </div>
  );
}

export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ m?: string; t?: string; ticket?: string; registered?: string }> }) {
  const { m, t, ticket: carried, registered } = await searchParams;
  const here = `/checkin?m=${encodeURIComponent(m ?? "")}&t=${encodeURIComponent(t ?? "")}`;
  const user = await requireUser(here);
  const repo = getRepo();
  const [passkey, meeting, existing] = await Promise.all([
    repo.getPasskeyByUser(user.id), m ? repo.getMeeting(m) : null, m ? repo.getAttendance(m, user.id) : null,
  ]);

  // A valid scan: either the QR token itself (checked as soon as the page opens, so nobody confirms their
  // fingerprint only to be told it expired), or a ticket carried back from registering their phone.
  const fromTicket = carried ? readScanTicketDetails(carried, user.id) : null;
  const scannedAt = fromTicket?.meetingId === m ? fromTicket!.scannedAt
    : meeting && t && verifyToken(meeting.id, meeting.qrSecret, t) ? Date.now() : null;

  // First scan ever: register the phone, then come straight back. A valid scan is carried through, so no rescan.
  if (!passkey) {
    const back = meeting && scannedAt ? `/checkin?m=${encodeURIComponent(meeting.id)}&ticket=${encodeURIComponent(makeScanTicket(meeting.id, user.id, scannedAt))}`
      : `/checkin?m=${encodeURIComponent(m ?? "")}&registered=1`;
    redirect(`/onboard?next=${encodeURIComponent(back)}`);
  }

  if (registered && !t) {
    return (
      <Notice title="Phone registered" action={<ScanAgain />}>
        One more scan and you&apos;re in{meeting ? ` to ${meeting.title}` : ""}: scan the code on the screen.
      </Notice>
    );
  }
  if (!m) {
    return (
      <Notice title="Scan the code to check in" action={<ScanAgain />}>
        Point your camera at the QR code on the screen at the meeting. It opens this page, ready to go.
      </Notice>
    );
  }
  if (!meeting) {
    return <Notice title="We couldn't find that meeting" tone="error" action={<ScanAgain />}>This link doesn&apos;t match a meeting. Scan the code on the screen again.</Notice>;
  }
  // Already in the register: show the record straight away, no tap or fingerprint needed.
  if (existing && (existing.status === "present" || existing.status === "late")) {
    // A lead may have marked them in by hand, with no check-in time.
    const at = existing.checkedInAt;
    return <Receipt status={existing.status} title={meeting.title} name={user.name} clock={at ? clock(at) : null} date={stampDate(at ?? meeting.startsAt)} already />;
  }
  if (meeting.status === "scheduled") {
    return <Notice title="Check-in hasn't opened yet">{meeting.title} starts {fmt(meeting.startsAt)}. Your lead opens check-in then; scan the code once it&apos;s on the screen.</Notice>;
  }
  if (meeting.status === "closed") {
    const mark: AttendanceStatus = existing?.status ?? "absent";
    const points = STRIKE_POINTS[mark];
    return (
      <Notice
        title="Check-in has closed"
        line={<RegisterLine name={user.name} mark={mark} status={mark} label={`Your line in the register: ${mark}`} />}
        action={<Link href="/me#excuse" className="btn-ghost btn-tall w-full">Request an excuse</Link>}
      >
        Check-in for {meeting.title} is closed. You&apos;re down as {mark}{points ? `, which counts as ${points} strike` : ", so no strike"}.
        {mark === "absent" && " Missed it for a good reason? You can request an excuse within 24 hours of the start."}
      </Notice>
    );
  }
  const [memberships, group] = meeting.groupId ? await Promise.all([repo.listMembershipsForUser(user.id), repo.getGroup(meeting.groupId)]) : [[], null];
  if (meeting.groupId && !memberships.some((g) => g.groupId === meeting.groupId)) {
    const groupName = group?.name ?? "one group";
    return <Notice title={`This one's for ${groupName}`}>{meeting.title} is only for {groupName} members, so there&apos;s nothing to check in to.</Notice>;
  }
  if (scannedAt === null) {
    return (
      <Notice title="That code has moved on" action={<><ScanAgain /><Link href="/me" className="btn-ghost btn-tall w-full">Go to my attendance</Link></>}>
        The code on the screen changes every 10 seconds. Scan it again to check in.
      </Notice>
    );
  }

  // Late is decided by the scan time, here and when they confirm, so what this screen shows is what they get.
  const late = statusForCheckIn(meeting.startsAt, meeting.graceMinutes, scannedAt) === "late";
  const minutesIn = Math.floor((scannedAt - new Date(meeting.startsAt).getTime()) / 60_000);
  const since = minutesIn < 1 ? "starts" : "started";
  const ago = minutesIn >= 1 && minutesIn < 120 ? ` (${minutesIn} min ago)` : "";
  return (
    <div className="checkin">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">{meeting.title}</h1>
        <p className="muted">{group?.name ?? "Full-body meeting"} · {since} at {clock(meeting.startsAt)}{ago}</p>
      </div>
      {late && <p className="alert">You&apos;re past the start, so this counts as late. Late doesn&apos;t add a strike.</p>}
      {existing && <p className="alert">You&apos;re down as {existing.status} for this one. Checking in now replaces that.</p>}

      <RegisterLine
        name={user.name} mark={late ? "late" : "not in yet"} status={late ? "late" : "present"}
        label={`Your line in the register: not checked in yet${late ? ", will be marked late" : ""}`}
      />

      <div className="checkin-action space-y-3">
        {/* A carried ticket is passed on as is, so reloading can't stretch its 2-minute life. */}
        <CheckIn ticket={fromTicket?.meetingId === m ? carried! : makeScanTicket(meeting.id, user.id, scannedAt)} title={meeting.title} name={user.name} late={late} />
        <p className="muted text-sm">Tap, then confirm with your fingerprint or face.</p>
        <details className="help muted text-sm">
          <summary>No fingerprint prompt, or not you?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Use the phone you registered, with its screen lock turned on.</li>
            <li>Changed phones? Ask an admin to reset your registration, then register the new one.</li>
            <li>Still stuck? Tell your lead before the meeting ends so they can mark you in.</li>
            <li>
              <form action="/api/auth/logout" method="post">
                Not {user.name}? <button className="underline underline-offset-2">Sign out and switch account</button>
              </form>
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}
