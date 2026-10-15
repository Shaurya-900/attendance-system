import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { backfillAbsences, closeMeeting } from "@/lib/meetings";
import { memoryRepo as repo } from "@/lib/repo/memory";
import { fetchAll } from "@/lib/repo/supabase";
import { computeStrikes } from "@/lib/strikes";
import type { Semester } from "@/lib/types";

describe("fetchAll (Supabase 1000-row cap)", () => {
  it("keeps paging until a short page", async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => ({ i }));
    const ranges: [number, number][] = [];
    const query = () => ({
      range: async (from: number, to: number) => { ranges.push([from, to]); return { data: rows.slice(from, to + 1), error: null }; },
    });
    expect(await fetchAll(query)).toHaveLength(2345);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
});

describe("closing a meeting is retryable", () => {
  it("fills gaps when run again on a closed meeting", async () => {
    const [, alice, bob] = await repo.listProfiles();
    const m = await repo.createMeeting({ title: "Retry", startsAt: new Date().toISOString(), graceMinutes: 10, groupId: null, createdBy: "user-0" });
    await repo.setMeetingStatus(m.id, "closed"); // a previous close died after this step
    await repo.upsertAttendance({ meetingId: m.id, userId: alice.id, status: "absent", checkedInAt: null, credentialId: null, deviceId: null, source: "manual", flags: [] });
    await closeMeeting(repo, m.id, "user-0");
    const rows = await repo.listAttendanceForMeeting(m.id);
    expect(rows.find((r) => r.userId === bob.id)?.status).toBe("absent");
    expect(rows.filter((r) => r.userId === alice.id)).toHaveLength(1);
  });
});

describe("late sign-ups can't dodge strikes", () => {
  it("backfills absences for closed meetings since being added to the roster", async () => {
    const userId = "late-joiner";
    await repo.upsertProfile({ id: userId, email: "late@ecell.test", name: "Late", rollNo: null, role: "member", active: true });
    const before = await repo.createMeeting({ title: "Before roster", startsAt: "2000-01-01T10:00:00.000Z", graceMinutes: 10, groupId: null, createdBy: "user-0" });
    const after1 = await repo.createMeeting({ title: "After 1", startsAt: "2030-01-01T10:00:00.000Z", graceMinutes: 10, groupId: null, createdBy: "user-0" });
    const after2 = await repo.createMeeting({ title: "After 2", startsAt: "2030-01-08T10:00:00.000Z", graceMinutes: 10, groupId: null, createdBy: "user-0" });
    const open = await repo.createMeeting({ title: "Still open", startsAt: "2030-01-15T10:00:00.000Z", graceMinutes: 10, groupId: null, createdBy: "user-0" });
    for (const m of [before, after1, after2]) await repo.setMeetingStatus(m.id, "closed");
    const ex = await repo.createExcuse({ meetingId: after2.id, userId, reason: "Exam" });
    await repo.setExcuseStatus(ex.id, "approved", "user-0");

    await backfillAbsences(repo, userId, "2020-01-01T00:00:00.000Z");

    const byMeeting = new Map((await repo.listAttendanceForUser(userId)).map((a) => [a.meetingId, a.status]));
    expect(byMeeting.has(before.id)).toBe(false);
    expect(byMeeting.get(after1.id)).toBe("absent");
    expect(byMeeting.get(after2.id)).toBe("excused");
    expect(byMeeting.has(open.id)).toBe(false);
  });
});

describe("untagged strike adjustments", () => {
  const sem: Semester = { id: "s1", name: "Odd", startsOn: "2026-07-01", endsOn: "2026-12-31" };
  it("count when made inside the semester's dates", () => {
    const s = computeStrikes([], [
      { points: 1, semesterId: null, createdAt: "2026-08-01T10:00:00.000Z" },
      { points: 5, semesterId: null, createdAt: "2026-01-01T10:00:00.000Z" },
    ], sem, "Asia/Kolkata");
    expect(s.points).toBe(1);
  });
});

describe("closing a meeting never overwrites a record", () => {
  it("keeps a check-in that landed while the meeting was closing", async () => {
    const [, alice] = await repo.listProfiles();
    const m = await repo.createMeeting({ title: "Race", startsAt: new Date().toISOString(), graceMinutes: 10, groupId: null, createdBy: "user-0" });
    await repo.setMeetingStatus(m.id, "live");
    const present = { meetingId: m.id, userId: alice.id, status: "present" as const, checkedInAt: new Date().toISOString(), credentialId: "c", deviceId: "d", source: "qr" as const, flags: [] };
    // The check-in lands after close has read the records but before it writes absentees.
    await repo.insertAttendance(present);
    await repo.insertMissingAttendance([{ ...present, status: "absent", checkedInAt: null, credentialId: null, deviceId: null, source: "manual" }]);
    expect((await repo.getAttendance(m.id, alice.id))?.status).toBe("present");
  });
});
