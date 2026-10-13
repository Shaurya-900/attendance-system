import { describe, expect, it } from "vitest";
import { applyApprovedExcuse, closeMeeting } from "@/lib/meetings";
import { memoryRepo as repo } from "@/lib/repo/memory";

describe("closing a meeting", () => {
  it("marks non-attendees absent, approved excuses excused, and leaves check-ins alone", async () => {
    const [, alice, bob, carol] = await repo.listProfiles();
    const m = await repo.createMeeting({ title: "Weekly", startsAt: new Date().toISOString(), graceMinutes: 10, createdBy: "user-0" });
    await repo.setMeetingStatus(m.id, "live");
    await repo.insertAttendance({ meetingId: m.id, userId: alice.id, status: "present", checkedInAt: new Date().toISOString(), credentialId: "c", deviceId: "d1", source: "qr", flags: [] });
    const ex = await repo.createExcuse({ meetingId: m.id, userId: bob.id, reason: "Exam" });
    await repo.setExcuseStatus(ex.id, "approved", "user-0");

    await closeMeeting(repo, m.id, "user-0");

    const byUser = new Map((await repo.listAttendanceForMeeting(m.id)).map((a) => [a.userId, a.status]));
    expect(byUser.get(alice.id)).toBe("present");
    expect(byUser.get(bob.id)).toBe("excused");
    expect(byUser.get(carol.id)).toBe("absent");
    expect(byUser.has("user-0")).toBe(false); // admins aren't tracked
    expect((await repo.getMeeting(m.id))?.status).toBe("closed");

    await applyApprovedExcuse(repo, m.id, carol.id);
    expect((await repo.listAttendanceForMeeting(m.id)).find((a) => a.userId === carol.id)?.status).toBe("excused");
  });

  it("rejects a second QR check-in from the same device", async () => {
    const [, alice, bob] = await repo.listProfiles();
    const m = await repo.createMeeting({ title: "Proxy test", startsAt: new Date().toISOString(), graceMinutes: 10, createdBy: "user-0" });
    const base = { meetingId: m.id, status: "present" as const, checkedInAt: null, credentialId: null, source: "qr" as const, flags: [] };
    expect(await repo.insertAttendance({ ...base, userId: alice.id, deviceId: "phone-1" })).toBe("ok");
    expect(await repo.insertAttendance({ ...base, userId: bob.id, deviceId: "phone-1" })).toBe("duplicate_device");
    expect(await repo.insertAttendance({ ...base, userId: alice.id, deviceId: "phone-2" })).toBe("duplicate_user");
  });
});

describe("semesters", () => {
  it("can be deleted", async () => {
    const s = await repo.createSemester({ name: "Dupe", startsOn: "2026-07-01", endsOn: "2026-12-31" });
    await repo.deleteSemester(s.id);
    expect((await repo.listSemesters()).some((x) => x.id === s.id)).toBe(false);
  });
});
