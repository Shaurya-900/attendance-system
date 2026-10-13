import { createHmac, timingSafeEqual } from "node:crypto";

/** Tamper-proof, expiring payload for short-lived cookies (e.g. WebAuthn challenges). */
export function seal(payload: Record<string, unknown>, secret: string, ttlMs: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now + ttlMs })).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function unseal<T extends Record<string, unknown>>(value: string | undefined, secret: string, now = Date.now()): T | null {
  if (!value) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("base64url"));
  const actual = Buffer.from(mac);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    return typeof data.exp === "number" && data.exp > now ? data : null;
  } catch {
    return null;
  }
}
