import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "./env";
import { getRepo } from "./repo";
import { createSessionClient } from "./supabase/server";
import type { Profile } from "./types";

export const DEV_USER_COOKIE = "dev_uid";

export async function getCurrentUser(): Promise<Profile | null> {
  let userId: string | undefined;
  if (env.backend === "memory") {
    userId = (await cookies()).get(DEV_USER_COOKIE)?.value;
  } else {
    const { data } = await (await createSessionClient()).auth.getUser();
    userId = data.user?.id;
  }
  if (!userId) return null;
  const profile = await getRepo().getProfile(userId);
  return profile?.active ? profile : null;
}

/** Only same-site relative paths, to avoid open redirects. */
export function safeNext(next: string | null | undefined, fallback = "/me"): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export async function requireUser(next?: string): Promise<Profile> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function requireAdmin(): Promise<Profile> {
  const user = await requireUser("/admin");
  if (user.role !== "admin") redirect("/me");
  return user;
}

/** Whether an email may sign in: right domain and present on the roster. */
export function emailDomainAllowed(email: string): boolean {
  const domain = env.allowedEmailDomain;
  return !domain || email.toLowerCase().endsWith(`@${domain}`);
}

export interface StaffContext {
  user: Profile;
  isAdmin: boolean;
  /** Groups this user leads (all groups for admins are implied by isAdmin). */
  ledGroupIds: Set<string>;
}

/** Admins, or members who lead at least one group. Leads only get their own groups' meetings. */
export async function getStaff(user: Profile): Promise<StaffContext> {
  const memberships = await getRepo().listGroupMembers();
  const ledGroupIds = new Set(memberships.filter((m) => m.userId === user.id && m.role === "lead").map((m) => m.groupId));
  return { user, isAdmin: user.role === "admin", ledGroupIds };
}

export async function requireStaff(next = "/admin"): Promise<StaffContext> {
  const staff = await getStaff(await requireUser(next));
  if (!staff.isAdmin && staff.ledGroupIds.size === 0) redirect("/me");
  return staff;
}

export function canManageGroup(staff: StaffContext, groupId: string | null): boolean {
  return staff.isAdmin || (!!groupId && staff.ledGroupIds.has(groupId));
}
