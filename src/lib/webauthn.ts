import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import type { NextResponse } from "next/server";
import { env } from "./env";
import { seal, unseal } from "./sealed";
import type { Passkey, Profile } from "./types";

export const CHALLENGE_COOKIE = "ecell_chal";
export const CHALLENGE_TTL_MS = 60_000;

export interface ChallengeState extends Record<string, unknown> {
  challenge: string;
  userId: string;
  purpose: "register" | "checkin";
  meetingId?: string;
}

export function setChallengeCookie(res: NextResponse, state: ChallengeState) {
  res.cookies.set(CHALLENGE_COOKIE, seal(state, env.appSecret, CHALLENGE_TTL_MS), {
    httpOnly: true,
    secure: env.secureCookies,
    sameSite: "strict",
    path: "/api",
    maxAge: CHALLENGE_TTL_MS / 1000,
  });
}

export function readChallenge(value: string | undefined): ChallengeState | null {
  return unseal<ChallengeState>(value, env.appSecret);
}

export function clearChallengeCookie(res: NextResponse) {
  res.cookies.set(CHALLENGE_COOKIE, "", { path: "/api", maxAge: 0 });
}

export function registrationOptions(user: Profile) {
  return generateRegistrationOptions({
    rpName: "E-Cell Attendance",
    rpID: env.rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    authenticatorSelection: {
      // The phone's own fingerprint/face/PIN — not a roaming key or someone else's phone.
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
  });
}

export async function verifyRegistration(response: RegistrationResponseJSON, expectedChallenge: string) {
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: env.origin,
    expectedRPID: env.rpID,
    requireUserVerification: true,
  });
  if (!result.verified || !result.registrationInfo) return null;
  const { credential } = result.registrationInfo;
  return {
    credentialId: credential.id,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    transports: (credential.transports ?? []) as string[],
  };
}

export function authenticationOptions(passkey: Passkey) {
  return generateAuthenticationOptions({
    rpID: env.rpID,
    userVerification: "required",
    allowCredentials: [{ id: passkey.credentialId, transports: passkey.transports as AuthenticatorTransportFuture[] }],
  });
}

export async function verifyAuthentication(response: AuthenticationResponseJSON, expectedChallenge: string, passkey: Passkey) {
  if (response.id !== passkey.credentialId) return null;
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: env.origin,
    expectedRPID: env.rpID,
    requireUserVerification: true,
    credential: {
      id: passkey.credentialId,
      publicKey: isoBase64URL.toBuffer(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports as AuthenticatorTransportFuture[],
    },
  });
  return result.verified ? result.authenticationInfo.newCounter : null;
}
