import { createHmac, timingSafeEqual } from "node:crypto";

/** The projected QR changes every window. */
export const QR_WINDOW_MS = 10_000;
/** A token is accepted for its own window plus this many following windows (so 10–20s of life). */
export const QR_GRACE_WINDOWS = 1;

export function windowAt(now: number): number {
  return Math.floor(now / QR_WINDOW_MS);
}

function sign(meetingId: string, secret: string, window: number): string {
  return createHmac("sha256", secret).update(`${meetingId}:${window}`).digest("base64url").slice(0, 22);
}

export function makeToken(meetingId: string, secret: string, now = Date.now()): string {
  const w = windowAt(now);
  return `${w.toString(36)}.${sign(meetingId, secret, w)}`;
}

/** Milliseconds until the projector should show a new token. */
export function msUntilNextWindow(now = Date.now()): number {
  return QR_WINDOW_MS - (now % QR_WINDOW_MS);
}

export function verifyToken(meetingId: string, secret: string, token: string, now = Date.now()): boolean {
  const [windowPart, sig] = token.split(".");
  if (!windowPart || !sig || !/^[0-9a-z]+$/.test(windowPart)) return false;
  const w = parseInt(windowPart, 36);
  const current = windowAt(now);
  if (!Number.isSafeInteger(w) || w > current || w < current - QR_GRACE_WINDOWS) return false;
  const expected = Buffer.from(sign(meetingId, secret, w));
  const actual = Buffer.from(sig);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
