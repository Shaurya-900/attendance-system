import { NextResponse, type NextRequest } from "next/server";
import { canManageGroup, getCurrentUser, getStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { makeToken, msUntilNextWindow } from "@/lib/qr-token";
import { expectedFrom } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  // Polled every few seconds, so load everything in one parallel round and check access afterwards.
  const [user, meeting, records, profiles] = await Promise.all([
    getCurrentUser(), repo.getMeeting(id), repo.listAttendanceForMeeting(id), repo.listProfiles(),
  ]);
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [staff, groupMembers] = await Promise.all([getStaff(user), meeting.groupId ? repo.listGroupMembers(meeting.groupId) : []]);
  if (!canManageGroup(staff, meeting.groupId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const checkedIn = records
    .filter((r) => r.status === "present" || r.status === "late")
    .sort((a, b) => (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? ""))
    .map((r) => ({ name: names.get(r.userId) ?? "Unknown", status: r.status, flags: r.flags, at: r.checkedInAt }));
  const total = expectedFrom(profiles, groupMembers, meeting).length;

  let qr: { url: string; refreshInMs: number } | null = null;
  if (meeting.status === "live") {
    const token = makeToken(meeting.id, meeting.qrSecret);
    qr = { url: `${env.origin}/checkin?m=${meeting.id}&t=${token}`, refreshInMs: msUntilNextWindow() };
  }
  return NextResponse.json(
    { status: meeting.status, title: meeting.title, qr, checkedIn, total },
    { headers: { "Cache-Control": "no-store" } },
  );
}
