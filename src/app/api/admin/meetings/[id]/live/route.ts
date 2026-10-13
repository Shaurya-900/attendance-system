import { NextResponse, type NextRequest } from "next/server";
import { canManageGroup, getCurrentUser, getStaff } from "@/lib/auth";
import { env } from "@/lib/env";
import { makeToken, msUntilNextWindow } from "@/lib/qr-token";
import { expectedMembers } from "@/lib/meetings";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const repo = getRepo();
  const meeting = await repo.getMeeting(id);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageGroup(await getStaff(user), meeting.groupId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [records, profiles] = await Promise.all([repo.listAttendanceForMeeting(id), repo.listProfiles()]);
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  const checkedIn = records
    .filter((r) => r.status === "present" || r.status === "late")
    .sort((a, b) => (b.checkedInAt ?? "").localeCompare(a.checkedInAt ?? ""))
    .map((r) => ({ name: names.get(r.userId) ?? "Unknown", status: r.status, flags: r.flags, at: r.checkedInAt }));
  const total = (await expectedMembers(repo, meeting)).length;

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
