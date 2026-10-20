import { describe, expect, it } from "vitest";
import { standings } from "@/lib/meetings";
import { memoryRepo as repo } from "@/lib/repo/memory";

describe("deleting", () => {
  it("a group removes its meetings, their records, and the strikes they gave", async () => {
    const [, alice] = await repo.listProfiles();
    const g = await repo.createGroup({ name: "Temp team", kind: "event", endsOn: null });
    await repo.setGroupMember(g.id, alice.id, "member");
    const m = await repo.createMeeting({ title: "Temp sync", startsAt: new Date().toISOString(), graceMinutes: 10, groupId: g.id, createdBy: "user-0" });
    await repo.upsertAttendance({ meetingId: m.id, userId: alice.id, status: "absent", checkedInAt: null, credentialId: null, deviceId: null, source: "manual", flags: [] });
    const before = (await standings(repo)).byUser.get(alice.id)![0].summary.points;

    await repo.deleteGroup(g.id);

    expect(await repo.getGroup(g.id)).toBeNull();
    expect(await repo.getMeeting(m.id)).toBeNull();
    expect(await repo.listGroupMembers(g.id)).toEqual([]);
    expect((await repo.listAttendanceForUser(alice.id)).some((a) => a.meetingId === m.id)).toBe(false);
    expect((await standings(repo)).byUser.get(alice.id)![0].summary.points).toBe(Math.max(0, before - 1));
  });

  it("a member removes their records and their members-list entry", async () => {
    const id = "to-delete";
    await repo.upsertRoster([{ email: "gone@ecell.test", name: "Gone", rollNo: null, role: "member" }]);
    await repo.upsertProfile({ id, email: "gone@ecell.test", name: "Gone", rollNo: null, role: "member", active: true });
    const m = await repo.createMeeting({ title: "X", startsAt: new Date().toISOString(), graceMinutes: 10, groupId: null, createdBy: "user-0" });
    await repo.upsertAttendance({ meetingId: m.id, userId: id, status: "absent", checkedInAt: null, credentialId: null, deviceId: null, source: "manual", flags: [] });
    await repo.addAdjustment({ userId: "user-1", semesterId: null, groupId: null, points: 1, reason: "x", createdBy: id });

    await repo.deleteMember(id);

    expect(await repo.getProfile(id)).toBeNull();
    expect(await repo.getRosterEntry("gone@ecell.test")).toBeNull();
    expect(await repo.listAttendanceForUser(id)).toEqual([]);
    expect((await repo.listAdjustments("user-1")).find((a) => a.reason === "x")?.createdBy).toBeNull();
  });
});
