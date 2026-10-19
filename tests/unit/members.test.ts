import { beforeEach, describe, expect, it } from "vitest";
import { expectedFrom } from "@/lib/meetings";
import { applyMemberChanges, checkMemberChanges, detailsAfter, joinReservedGroups } from "@/lib/members";
import { memoryRepo as repo } from "@/lib/repo/memory";

const opts = { actorId: "user-0", domain: null };
const alice = { name: "Alice Member", rollNo: "2410110001", email: "alice@ecell.test", role: "member" as const };

beforeEach(() => {
  (globalThis as { __ecellStore?: unknown }).__ecellStore = undefined; // fresh demo data per test
});

describe("checkMemberChanges", () => {
  it("returns only what changed, with the name capitalised", async () => {
    const r = await checkMemberChanges(repo, alice.email, { ...alice, name: "alice  SHAH", role: "admin" }, opts);
    expect(r).toEqual({ changes: { name: "Alice Shah", role: "admin" } });
  });

  it("rejects bad or taken details, no-op edits and changing your own rights", async () => {
    const err = async (wanted: Partial<typeof alice>, target = alice.email) =>
      ("error" in (await checkMemberChanges(repo, target, { ...alice, ...wanted }, opts)));
    expect(await err({ name: "Alice 2" })).toBe(true);
    expect(await err({ rollNo: "24101100" })).toBe(true);
    expect(await err({ rollNo: "2410110002" })).toBe(true); // Bob's
    expect(await err({ email: "bob@ecell.test" })).toBe(true);
    expect(await err({})).toBe(true);
    expect(await err({ name: "Core Admin", rollNo: "2210110001", email: "admin@ecell.test", role: "member" }, "admin@ecell.test")).toBe(true);
  });
});

describe("applyMemberChanges", () => {
  it("updates profile and roster, follows a new SNU mail ID, and keeps reserved teams", async () => {
    await repo.upsertRoster([{ email: "new@ecell.test", name: "New Person", rollNo: "2610110001", role: "member" }]);
    await repo.addRosterGroup("new@ecell.test", "g1");
    await applyMemberChanges(repo, "new@ecell.test", { email: "renamed@ecell.test", name: "Renamed Person" });
    expect(await repo.getRosterEntry("new@ecell.test")).toBeNull();
    expect((await repo.getRosterEntry("renamed@ecell.test"))?.name).toBe("Renamed Person");
    expect(await repo.listRosterGroups({ email: "renamed@ecell.test" })).toEqual([{ email: "renamed@ecell.test", groupId: "g1" }]);

    await applyMemberChanges(repo, alice.email, { rollNo: "2610110002" });
    expect((await repo.getProfile("user-1"))?.rollNo).toBe("2610110002");
    expect((await repo.getRosterEntry(alice.email))?.rollNo).toBe("2610110002");
  });

  it("removing admin rights also removes approver rights", async () => {
    await applyMemberChanges(repo, "admin@ecell.test", { role: "member" });
    expect(await repo.getProfile("user-0")).toMatchObject({ role: "member", approver: false });
  });

  it("detailsAfter merges a pending request onto current details", async () => {
    expect(await detailsAfter(repo, alice.email, { name: "Alice Shah" })).toEqual({ ...alice, name: "Alice Shah" });
  });
});

describe("joinReservedGroups", () => {
  it("turns reserved places into memberships on first sign-in", async () => {
    await repo.addRosterGroup("new@ecell.test", "g1");
    await repo.addRosterGroup("new@ecell.test", "g2");
    await joinReservedGroups(repo, "user-new", "new@ecell.test");
    expect((await repo.listMembershipsForUser("user-new")).map((m) => [m.groupId, m.role]).sort()).toEqual([["g1", "member"], ["g2", "member"]]);
    expect(await repo.listRosterGroups({ email: "new@ecell.test" })).toEqual([]);
  });
});

describe("advisors", () => {
  it("can't be made or unmade from the app", async () => {
    const r = await checkMemberChanges(repo, alice.email, { ...alice, role: "advisor" }, opts);
    expect("error" in r && r.error).toMatch(/database/);
    await repo.upsertProfile({ ...(await repo.getProfile("user-2"))!, role: "advisor" });
    const bob = { name: "Bob Member", rollNo: "2410110002", email: "bob@ecell.test" };
    expect("error" in (await checkMemberChanges(repo, bob.email, { ...bob, role: "member" }, opts))).toBe(true);
    expect(await checkMemberChanges(repo, bob.email, { ...bob, name: "Bob Advisor", role: "advisor" }, opts)).toEqual({ changes: { name: "Bob Advisor" } });
  });

  it("are never expected at meetings, even in their groups", async () => {
    const profiles = (await repo.listProfiles()).map((p) => (p.id === "user-2" ? { ...p, role: "advisor" as const } : p));
    const members = ["user-1", "user-2"].map((userId) => ({ groupId: "g1", userId, role: "member" as const, addedAt: "" }));
    expect(expectedFrom(profiles, members, { groupId: "g1" }).map((p) => p.id)).toEqual(["user-1"]);
    expect(expectedFrom(profiles, [], { groupId: null }).map((p) => p.id)).toEqual(["user-1", "user-3"]);
  });
});
