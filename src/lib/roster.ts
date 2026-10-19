import type { Role } from "./types";

/** SNU roll numbers: 10 digits starting with 2, e.g. 2610110014. */
export const ROLL_NO = /^2\d{9}$/;

/**
 * Parse roster lines pasted from Excel or typed by hand, separated by tabs, commas or spaces. In each line the word with
 * an "@" is the email (what we call the SNU ID), the first word with digits is the roll number, an "admin" word makes them an
 * admin, and the remaining words are the name. So `name roll_no snu_id [admin]` works in any column order.
 * Names may not contain digits. A header row (no "@" and no digits) is skipped; bad lines, and emails outside `domain` when one is set, come back in `rejected`.
 */
export function parseRoster(csv: string, domain: string | null = null) {
  const entries: { email: string; name: string; rollNo: string | null; role: Role }[] = [];
  const rejected: string[] = [];
  for (const line of csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    if (!/[@\d]/.test(line)) continue; // header row: no email and no roll number
    const words = line.split(/[\s,]+/).filter(Boolean);
    const email = words.find((w) => w.includes("@"))?.toLowerCase() ?? "";
    const rollNo = words.find((w) => /\d/.test(w) && !w.includes("@")) ?? null;
    const admin = words.some((w) => w.toLowerCase() === "admin");
    const name = words.filter((w) => !w.includes("@") && w !== rollNo && w.toLowerCase() !== "admin").join(" ");
    const badEmail = !email || (domain !== null && !email.endsWith(`@${domain}`));
    if (badEmail || !name || /\d/.test(name) || (rollNo && !ROLL_NO.test(rollNo))) rejected.push(line);
    else entries.push({ email, name, rollNo, role: admin ? "admin" : "member" });
  }
  return { entries, rejected };
}
