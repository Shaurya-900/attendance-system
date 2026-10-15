import { afterEach, describe, expect, it, vi } from "vitest";
import { makeScanTicket, readScanTicket, SCAN_TICKET_TTL_MS } from "@/lib/scan-ticket";
import { seal } from "@/lib/sealed";

process.env.APP_SECRET = "test-secret";

describe("scan tickets", () => {
  afterEach(() => vi.useRealTimers());

  it("work for the member who scanned, for this meeting", () => {
    expect(readScanTicket(makeScanTicket("m1", "alice"), "alice")).toBe("m1");
  });

  it("are useless to anyone else", () => {
    expect(readScanTicket(makeScanTicket("m1", "alice"), "bob")).toBeNull();
  });

  it("expire", () => {
    vi.useFakeTimers();
    const ticket = makeScanTicket("m1", "alice");
    vi.advanceTimersByTime(SCAN_TICKET_TTL_MS + 1);
    expect(readScanTicket(ticket, "alice")).toBeNull();
  });

  it("can't be forged or swapped for another sealed value", () => {
    expect(readScanTicket(makeScanTicket("m1", "alice").replace(/.$/, "x"), "alice")).toBeNull();
    const challenge = seal({ purpose: "checkin", meetingId: "m1", userId: "alice", challenge: "c" }, "test-secret", 60_000);
    expect(readScanTicket(challenge, "alice")).toBeNull();
  });
});
