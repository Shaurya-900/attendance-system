import { describe, expect, it } from "vitest";
import { memoryRepo as repo } from "@/lib/repo/memory";
import type { Attendance } from "@/lib/types";

describe("QR check-in over an existing record", () => {
  it("replaces an absence or excuse, but never a present/late check-in", async () => {
    const [, alice, bob] = await repo.listProfiles();
    const m = await repo.createMeeting({ title: "Upgrade", startsAt: new Date().toISOString(), graceMinutes: 10, groupId: null, createdBy: "user-0" });
    const qr = (userId: string, deviceId: string): Attendance => ({ meetingId: m.id, userId, status: "late", checkedInAt: new Date().toISOString(), credentialId: "c", deviceId, source: "qr", flags: [] });
    await repo.upsertAttendance({ ...qr(alice.id, ""), status: "excused", checkedInAt: null, deviceId: null, source: "manual" });
    await repo.upsertAttendance({ ...qr(bob.id, ""), status: "absent", checkedInAt: null, deviceId: null, source: "manual" });

    expect(await repo.insertAttendance(qr(alice.id, "phone-a"))).toBe("ok");
    expect((await repo.getAttendance(m.id, alice.id))?.status).toBe("late");
    expect(await repo.insertAttendance(qr(alice.id, "phone-a2"))).toBe("duplicate_user");
    // Bob can't upgrade his absence with Alice's phone.
    expect(await repo.insertAttendance(qr(bob.id, "phone-a"))).toBe("duplicate_device");
    expect((await repo.getAttendance(m.id, bob.id))?.status).toBe("absent");
  });
});
