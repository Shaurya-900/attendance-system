import type { Repo } from "./repo/types";
import { ROLL_NO, titleCase } from "./roster";
import type { MemberChanges, Profile, Role, RosterEntry } from "./types";

export interface MemberDetails {
  name: string;
  rollNo: string | null;
  email: string;
  role: Role;
}

/** Someone on the members list, signed up or not. Signed-up members have a profile; most also have a roster entry. */
export async function findMember(repo: Repo, email: string): Promise<{ profile?: Profile; roster?: RosterEntry } | null> {
  const [profiles, roster] = await Promise.all([repo.listProfiles(), repo.getRosterEntry(email)]);
  const profile = profiles.find((p) => p.email === email);
  return profile || roster ? { profile, roster: roster ?? undefined } : null;
}

/**
 * Check the details an admin wants for a member and return only what differs from now.
 * Names are capitalised and may not contain digits; roll numbers and SNU mail IDs must not belong to anyone else.
 */
export async function checkMemberChanges(
  repo: Repo, targetEmail: string, wanted: MemberDetails, opts: { actorId: string; domain: string | null },
): Promise<{ changes: MemberChanges } | { error: string }> {
  const member = await findMember(repo, targetEmail);
  if (!member) return { error: "That member no longer exists." };
  const now = member.profile ?? member.roster!;
  const name = titleCase(wanted.name.trim().replace(/\s+/g, " "));
  const rollNo = wanted.rollNo?.trim() || null;
  const email = wanted.email.trim().toLowerCase();
  if (!name || /\d/.test(name)) return { error: "Enter a name without numbers." };
  if (rollNo && !ROLL_NO.test(rollNo)) return { error: "Roll numbers are 10 digits starting with 2." };
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || (opts.domain && !email.endsWith(`@${opts.domain}`))) {
    return { error: `Enter an SNU mail ID${opts.domain ? ` ending in @${opts.domain}` : ""}.` };
  }
  if (member.profile?.id === opts.actorId && wanted.role !== now.role) return { error: "You can't change your own admin rights." };

  const [profiles, roster] = await Promise.all([repo.listProfiles(), repo.listRoster()]);
  const others = [...profiles, ...roster].filter((p) => p.email !== targetEmail);
  if (email !== targetEmail && others.some((p) => p.email === email)) return { error: `${email} already belongs to someone else.` };
  const rollOwner = rollNo && others.find((p) => p.rollNo === rollNo);
  if (rollOwner) return { error: `Roll number ${rollNo} already belongs to ${rollOwner.name}.` };

  const changes: MemberChanges = {};
  if (name !== now.name) changes.name = name;
  if (rollNo !== now.rollNo) changes.rollNo = rollNo;
  if (email !== targetEmail) changes.email = email;
  if (wanted.role !== now.role) changes.role = wanted.role;
  return Object.keys(changes).length ? { changes } : { error: "Nothing was changed." };
}

/** The member's details with `changes` applied, for re-checking a request before it's approved. */
export async function detailsAfter(repo: Repo, targetEmail: string, changes: MemberChanges): Promise<MemberDetails | null> {
  const member = await findMember(repo, targetEmail);
  if (!member) return null;
  const now = member.profile ?? member.roster!;
  return { name: now.name, rollNo: now.rollNo, email: targetEmail, role: now.role, ...changes };
}

/** Apply checked changes to the roster entry, the profile and, for a new SNU mail ID, the login. Losing admin also ends approver rights. */
export async function applyMemberChanges(repo: Repo, targetEmail: string, changes: MemberChanges) {
  const member = await findMember(repo, targetEmail);
  if (!member) return;
  const { profile, roster } = member;
  // The login first: if it fails, nothing else has changed.
  if (profile && changes.email) await repo.updateAuthEmail(profile.id, changes.email);
  if (roster) await repo.updateRosterEntry(targetEmail, { ...roster, ...changes });
  if (profile) {
    await repo.upsertProfile({ ...profile, ...changes, approver: (changes.role ?? profile.role) === "admin" ? profile.approver : false });
  }
}

/** On first sign-in, turn the team places an admin reserved for this person into real memberships. */
export async function joinReservedGroups(repo: Repo, userId: string, email: string) {
  const reserved = await repo.listRosterGroups({ email });
  await Promise.all(reserved.map(async (r) => {
    await repo.setGroupMember(r.groupId, userId, "member");
    await repo.removeRosterGroup(email, r.groupId);
  }));
}
