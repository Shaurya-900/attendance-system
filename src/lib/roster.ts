import type { Role } from "./types";

/** SNU roll numbers: 11 digits starting with 2, e.g. 24010110104. */
export const ROLL_NO = /^2\d{10}$/;

const HEADERS = new Set(["email", "snu id"]);

/**
 * Parse roster lines, comma- or tab-separated so rows can be pasted straight from Excel. The cell with an "@" is the
 * email (what we call the SNU ID); the rest are name, roll_no and an optional "admin", in that order. So both
 * `name,roll_no,snu_id[,admin]` and `email,name,roll_no[,admin]` work. A header row is skipped; bad lines come back in `rejected`.
 */
export function parseRoster(csv: string) {
  const entries: { email: string; name: string; rollNo: string | null; role: Role }[] = [];
  const rejected: string[] = [];
  for (const line of csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const cells = line.split(/[,\t]/).map((s) => s.trim());
    if (cells.some((c) => HEADERS.has(c.toLowerCase()))) continue;
    const email = cells.find((c) => c.includes("@")) ?? "";
    const [name, rollNo, role] = cells.filter((c) => c !== email);
    if (!email || !name || (rollNo && !ROLL_NO.test(rollNo))) rejected.push(line);
    else entries.push({ email: email.toLowerCase(), name, rollNo: rollNo || null, role: role?.toLowerCase() === "admin" ? "admin" : "member" });
  }
  return { entries, rejected };
}
