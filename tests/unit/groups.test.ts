import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));

import { canManageGroup, getStaff } from "@/lib/auth";
import { closeMeeting, expectedMembers, isGroupActive, standings } from "@/lib/meetings";
import { memoryRepo as repo } from "@/lib/repo/memory";

async function setup() {
  const [admin, alice, bob, carol] = await repo.listProfiles();
  const leads = await repo.createGroup({ name: `Leads ${Math.random()}`, kind: "leads", endsOn: null });
  await repo.setGroupMember(leads.id, alice.id, "lead");
  await repo.setGroupMember(leads.id, bob.id, "member");
  return { admin, alice, bob, carol, leads };
}

describe("group meetings", () => {
  it("only expect the group's members", async () => {
    const { alice, bob, carol, leads } = await setup();
    const m = await repo.createMeeting({ title: "Leads sync", startsAt: new Date().toISOString(), graceMinutes: 10, groupId: leads.id, createdBy: "user-0" });
    expect((await expectedMembers(repo, m)).map((p) => p.id).sort()).toEqual([alice.id, bob.id].sort());
    await closeMeeting(repo, m.id, "user-0");
    const rows = await repo.listAttendanceForMeeting(m.id);
    expect(rows.map((r) => r.userId).sort()).toEqual([alice.id, bob.id].sort());
    expect(rows.some((r) => r.userId === carol.id)).toBe(false);
  });

  it("keep a separate strike count from full body", async () => {
    const { bob, leads } = await setup();
    const m = await repo.createMeeting({ title: "Leads 2", startsAt: new Date().toISOString(), graceMinutes: 10, groupId: leads.id, createdBy: "user-0" });
    const before = (await standings(repo)).byUser.get(bob.id)!;
    const fullBefore = before.find((s) => !s.group)!.summary.points;
    await closeMeeting(repo, m.id, "user-0");
    const after = (await standings(repo)).byUser.get(bob.id)!;
    expect(after.find((s) => !s.group)!.summary.points).toBe(fullBefore);
    expect(after.find((s) => s.group?.id === leads.id)!.summary.points).toBe(1);
  });

  it("let leads manage only their own group", async () => {
    const { alice, bob, leads } = await setup();
    const other = await repo.createGroup({ name: "Marketing", kind: "team", endsOn: null });
    const aliceStaff = await getStaff(alice);
    expect(canManageGroup(aliceStaff, leads.id)).toBe(true);
    expect(canManageGroup(aliceStaff, other.id)).toBe(false);
    expect(canManageGroup(aliceStaff, null)).toBe(false); // full body is admin-only
    expect((await getStaff(bob)).ledGroupIds.has(leads.id)).toBe(false);
  });

  it("treat event teams as ended after their end date", () => {
    const g = { id: "g", name: "TEDx team", kind: "event" as const, endsOn: "2026-03-01", archived: false, createdAt: "" };
    expect(isGroupActive(g, new Date("2026-02-28T06:00:00Z"))).toBe(true);
    expect(isGroupActive(g, new Date("2026-03-02T06:00:00Z"))).toBe(false);
    expect(isGroupActive({ ...g, endsOn: null, archived: true })).toBe(false);
  });
});

describe("standingsForUser", () => {
  it("matches the full standings for that member", async () => {
    const { standingsForUser } = await import("@/lib/meetings");
    for (const p of await repo.listProfiles()) {
      const all = (await standings(repo)).byUser.get(p.id)!;
      const mine = (await standingsForUser(repo, p.id)).scopes;
      expect(mine).toEqual(all);
    }
  });
});
