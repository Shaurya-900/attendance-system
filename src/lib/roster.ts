import type { Role } from "./types";

/** SNU roll numbers: 10 digits starting with 2, e.g. 2610110014. */
export const ROLL_NO = /^2\d{9}$/;

/** "pranik reddy MANNE" -> "Pranik Reddy Manne"; also after hyphens and apostrophes ("D'Souza", "Mary-Jane"). */
export const titleCase = (name: string) => name.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());

/**
 * Parse roster lines pasted from Excel or typed by hand, separated by tabs, commas or spaces. In each line the word with
 * an "@" is the email (what we call the SNU ID), the first word with digits is the roll number, an "admin" word makes them an
 * admin, and the remaining words are the name. So `name roll_no snu_id [admin]` works in any column order.
 * Names are capitalised word by word and may not contain digits. A header row (no "@" and no digits) is skipped; bad lines, and emails outside `domain` when one is set, come back in `rejected`.
 * Lines repeating an email or roll number from earlier in the paste, or using a roll number that `existing` gives to a
 * different email, come back in `duplicates`.
 */
export function parseRoster(csv: string, domain: string | null = null, existing: { email: string; rollNo: string | null }[] = []) {
  const entries: { email: string; name: string; rollNo: string | null; role: Role }[] = [];
  const rejected: string[] = [];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  const rollOwner = new Map(existing.flatMap((r) => (r.rollNo ? [[r.rollNo, r.email] as const] : [])));
  for (const line of csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    if (!/[@\d]/.test(line)) continue; // header row: no email and no roll number
    const words = line.split(/[\s,]+/).filter(Boolean);
    const email = words.find((w) => w.includes("@"))?.toLowerCase() ?? "";
    const rollNo = words.find((w) => /\d/.test(w) && !w.includes("@")) ?? null;
    const admin = words.some((w) => w.toLowerCase() === "admin");
    const name = titleCase(words.filter((w) => !w.includes("@") && w !== rollNo && w.toLowerCase() !== "admin").join(" "));
    const badEmail = !email || (domain !== null && !email.endsWith(`@${domain}`));
    if (badEmail || !name || /\d/.test(name) || (rollNo && !ROLL_NO.test(rollNo))) rejected.push(line);
    else if (seen.has(email) || (rollNo && (seen.has(rollNo) || (rollOwner.get(rollNo) ?? email) !== email))) duplicates.push(line);
    else {
      seen.add(email);
      if (rollNo) seen.add(rollNo);
      entries.push({ email, name, rollNo, role: admin ? "admin" : "member" });
    }
  }
  return { entries, rejected, duplicates };
}
