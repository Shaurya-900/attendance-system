import { env } from "./env";
import { seal, unseal } from "./sealed";

/**
 * After a member opens the check-in page with a valid QR token, they get this ticket so a slow
 * tap doesn't fail with "QR expired". It's bound to their account and the meeting, so it's no use
 * to anyone else: someone outside still has to receive and open the QR link within its 10-20 s.
 */
export const SCAN_TICKET_TTL_MS = 2 * 60_000;

interface ScanTicket extends Record<string, unknown> {
  purpose: "scan";
  meetingId: string;
  userId: string;
}

export function makeScanTicket(meetingId: string, userId: string): string {
  return seal({ purpose: "scan", meetingId, userId } satisfies ScanTicket, env.appSecret, SCAN_TICKET_TTL_MS);
}

/** The meeting id, if the ticket is genuine, unexpired and belongs to this user. */
export function readScanTicket(ticket: string, userId: string): string | null {
  const t = unseal<ScanTicket>(ticket, env.appSecret);
  return t?.purpose === "scan" && t.userId === userId && typeof t.meetingId === "string" ? t.meetingId : null;
}
