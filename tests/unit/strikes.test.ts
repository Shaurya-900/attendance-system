import { describe, expect, it } from "vitest";
import { computeStrikes, currentSemester, levelFor, localDate, statusForCheckIn } from "@/lib/strikes";
import type { Semester } from "@/lib/types";

const tz = "Asia/Kolkata";
const sem: Semester = { id: "s1", name: "Odd 2026", startsOn: "2026-07-01", endsOn: "2026-12-31" };
const at = (d: string) => `${d}T12:00:00.000Z`;

describe("strike levels", () => {
  it("uses 2 = warning and 3 = flagged", () => {
    expect(levelFor(0)).toBe("ok");
    expect(levelFor(1.5)).toBe("ok");
    expect(levelFor(2)).toBe("warning");
    expect(levelFor(2.5)).toBe("warning");
    expect(levelFor(3)).toBe("flagged");
  });
});

describe("computeStrikes", () => {
  it("counts absences as 1, lates as 0.5 and excused as 0", () => {
    const s = computeStrikes(
      [
        { status: "absent", meetingStartsAt: at("2026-08-01") },
        { status: "late", meetingStartsAt: at("2026-08-08") },
        { status: "late", meetingStartsAt: at("2026-08-15") },
        { status: "excused", meetingStartsAt: at("2026-08-22") },
        { status: "present", meetingStartsAt: at("2026-08-29") },
      ],
      [], sem, tz,
    );
    expect(s).toMatchObject({ points: 2, absences: 1, lates: 2, excused: 1, level: "warning" });
  });

  it("three absences flag the member", () => {
    const recs = ["2026-08-01", "2026-08-08", "2026-08-15"].map((d) => ({ status: "absent" as const, meetingStartsAt: at(d) }));
    expect(computeStrikes(recs, [], sem, tz).level).toBe("flagged");
  });

  it("ignores meetings outside the semester (reset each semester)", () => {
    const s = computeStrikes(
      [
        { status: "absent", meetingStartsAt: at("2026-05-01") },
        { status: "absent", meetingStartsAt: at("2026-07-01") },
      ],
      [], sem, tz,
    );
    expect(s.points).toBe(1);
  });

  it("uses the club's timezone for semester boundaries", () => {
    // 2026-06-30T20:00Z is 01:30 on 1 July in India.
    expect(localDate("2026-06-30T20:00:00.000Z", tz)).toBe("2026-07-01");
    expect(computeStrikes([{ status: "absent", meetingStartsAt: "2026-06-30T20:00:00.000Z" }], [], sem, tz).points).toBe(1);
  });

  it("applies adjustments for the semester and never goes negative", () => {
    const recs = [{ status: "absent" as const, meetingStartsAt: at("2026-08-01") }];
    expect(computeStrikes(recs, [{ points: 1, semesterId: "s1" }, { points: 5, semesterId: "old" }], sem, tz).points).toBe(2);
    expect(computeStrikes(recs, [{ points: -3, semesterId: "s1" }], sem, tz).points).toBe(0);
  });

  it("counts everything when no semester is configured", () => {
    const recs = [{ status: "absent" as const, meetingStartsAt: at("2020-01-01") }];
    expect(computeStrikes(recs, [{ points: 1, semesterId: "x" }], null, tz).points).toBe(2);
  });
});

describe("check-in timing", () => {
  const start = "2026-08-01T10:00:00.000Z";
  it("is present within the grace period and late after", () => {
    expect(statusForCheckIn(start, 10, Date.parse("2026-08-01T10:10:00.000Z"))).toBe("present");
    expect(statusForCheckIn(start, 10, Date.parse("2026-08-01T10:10:01.000Z"))).toBe("late");
    expect(statusForCheckIn(start, 10, Date.parse("2026-08-01T09:50:00.000Z"))).toBe("present");
  });
});

describe("currentSemester", () => {
  it("finds the semester containing today", () => {
    expect(currentSemester([sem], tz, new Date("2026-10-13T06:00:00Z"))?.id).toBe("s1");
    expect(currentSemester([sem], tz, new Date("2027-01-02T06:00:00Z"))).toBeNull();
  });
});
