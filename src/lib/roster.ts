import type { Role } from "./types";

/** SNU roll numbers: 11 digits starting with 2, e.g. 24010110104. */
export const ROLL_NO = /^2\d{10}$/;

/** Parse CSV lines `email,name,roll_no[,admin]`. A header row is skipped; bad lines come back in `rejected`. */
export function parseRoster(csv: string) {
  const entries: { email: string; name: string; rollNo: string | null; role: Role }[] = [];
  const rejected: string[] = [];
  for (const line of csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const [email = "", name, rollNo, role] = line.split(",").map((s) => s.trim());
    if (email.toLowerCase() === "email") continue;
    if (!email.includes("@") || !name || (rollNo && !ROLL_NO.test(rollNo))) rejected.push(line);
    else entries.push({ email: email.toLowerCase(), name, rollNo: rollNo || null, role: role === "admin" ? "admin" : "member" });
  }
  return { entries, rejected };
}
