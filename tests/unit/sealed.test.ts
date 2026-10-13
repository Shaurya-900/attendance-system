import { describe, expect, it } from "vitest";
import { seal, unseal } from "@/lib/sealed";

describe("sealed cookies", () => {
  it("round-trips before expiry", () => {
    const v = seal({ challenge: "abc", userId: "u1" }, "k", 60_000, 1000);
    expect(unseal(v, "k", 2000)).toMatchObject({ challenge: "abc", userId: "u1" });
  });
  it("expires", () => {
    expect(unseal(seal({ a: 1 }, "k", 60_000, 0), "k", 60_001)).toBeNull();
  });
  it("rejects tampering and wrong key", () => {
    const v = seal({ userId: "u1" }, "k", 60_000, 0);
    const [body, mac] = v.split(".");
    const forged = Buffer.from(JSON.stringify({ userId: "u2", exp: 1e15 })).toString("base64url");
    expect(unseal(`${forged}.${mac}`, "k", 1)).toBeNull();
    expect(unseal(`${body}.${mac}`, "other", 1)).toBeNull();
    expect(unseal("garbage", "k", 1)).toBeNull();
  });
});
