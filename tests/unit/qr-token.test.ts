import { describe, expect, it } from "vitest";
import { makeToken, QR_WINDOW_MS, verifyToken } from "@/lib/qr-token";

const secret = "s3cret";
const t0 = 1_760_000_000_000; // start of a window

describe("rotating QR token", () => {
  it("accepts a fresh token", () => {
    expect(verifyToken("m1", secret, makeToken("m1", secret, t0), t0 + 1000)).toBe(true);
  });
  it("accepts a token from the previous window (scan latency)", () => {
    expect(verifyToken("m1", secret, makeToken("m1", secret, t0), t0 + QR_WINDOW_MS + 5000)).toBe(true);
  });
  it("rejects a token older than two windows (forwarded photo)", () => {
    expect(verifyToken("m1", secret, makeToken("m1", secret, t0), t0 + 2 * QR_WINDOW_MS)).toBe(false);
  });
  it("rejects tokens from the future", () => {
    expect(verifyToken("m1", secret, makeToken("m1", secret, t0 + QR_WINDOW_MS), t0)).toBe(false);
  });
  it("rejects a token for another meeting", () => {
    expect(verifyToken("m2", secret, makeToken("m1", secret, t0), t0)).toBe(false);
  });
  it("rejects a token signed with another secret", () => {
    expect(verifyToken("m1", secret, makeToken("m1", "other", t0), t0)).toBe(false);
  });
  it("rejects tampered or malformed tokens", () => {
    const tok = makeToken("m1", secret, t0);
    const [w, sig] = tok.split(".");
    expect(verifyToken("m1", secret, `${w}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`, t0)).toBe(false);
    expect(verifyToken("m1", secret, `${(parseInt(w, 36) + 0).toString(36)}`, t0)).toBe(false);
    expect(verifyToken("m1", secret, "", t0)).toBe(false);
    expect(verifyToken("m1", secret, "ZZ.abc", t0)).toBe(false);
  });
});
