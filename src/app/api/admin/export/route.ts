import { NextResponse, type NextRequest } from "next/server";
import { canManageGroup, getCurrentUser, getStaff } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  // Quote everything; neutralise spreadsheet formula injection.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Forbidden", { status: 403 });
  const meetingId = new URL(req.url).searchParams.get("meeting");
  const repo = getRepo();
  // Leads may export their own group's meetings; the full export is admin-only.
  const staff = await getStaff(user);
  const target = meetingId ? await repo.getMeeting(meetingId) : null;
  if (!staff.isAdmin && !(target && canManageGroup(staff, target.groupId))) return new NextResponse("Forbidden", { status: 403 });
  const [meetings, profiles, attendance] = await Promise.all([repo.listMeetings(), repo.listProfiles(), repo.listAllAttendance()]);
  const byMeeting = new Map(meetings.map((m) => [m.id, m]));
  const byUser = new Map(profiles.map((p) => [p.id, p]));
  const rows = attendance
    .filter((a) => !meetingId || a.meetingId === meetingId)
    .map((a) => {
      const m = byMeeting.get(a.meetingId);
      const p = byUser.get(a.userId);
      return [m?.title, m?.startsAt, p?.name, p?.email, p?.rollNo, a.status, a.checkedInAt, a.source, a.flags.join(" ")];
    });
  const csv = [["meeting", "starts_at", "name", "email", "roll_no", "status", "checked_in_at", "source", "flags"], ...rows]
    .map((r) => r.map(csvCell).join(","))
    .join("\n");
  return new NextResponse(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="attendance.csv"` },
  });
}
