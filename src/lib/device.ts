import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";
import { env } from "./env";

/** Long-lived, httpOnly random ID identifying the phone a member registered/checks in with. */
export const DEVICE_COOKIE = "ecell_did";

export function newDeviceId(): string {
  return randomBytes(18).toString("base64url");
}

export function setDeviceCookie(res: NextResponse, deviceId: string) {
  res.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 5,
  });
}
