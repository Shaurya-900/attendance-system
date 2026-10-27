import { ROLL_NO } from "./roster";

export interface GroupSheetRow {
  group: string;
  email: string | null;
  rollNo: string | null;
  lead: boolean;
}

/**
 * Parse a sheet pasted from Excel or Google Sheets, one person per line: `team name, SNU mail ID or roll no [, lead]`,
 * separated by tabs or commas. The first cell is the team; in the rest, the word with an "@" is the SNU mail ID, a roll
 * number works instead, and a "lead" word makes them the team's lead. A header row (no "@", no roll number) is skipped;
 * lines that name nobody come back in `rejected`.
 */
export function parseGroupSheet(text: string) {
  const rows: GroupSheetRow[] = [];
  const rejected: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const [first = "", ...rest] = line.split(/[\t,;]/).map((c) => c.trim());
    const words = rest.join(" ").split(/\s+/).filter(Boolean);
    const email = words.find((w) => w.includes("@"))?.toLowerCase() ?? null;
    const rollNo = words.find((w) => ROLL_NO.test(w)) ?? null;
    if (!email && !rollNo) {
      if (i > 0 || /[@\d]/.test(line)) rejected.push(line); // only the first line may be a header row
      continue;
    }
    if (!first) { rejected.push(line); continue; }
    rows.push({ group: first.replace(/\s+/g, " "), email, rollNo, lead: words.some((w) => w.toLowerCase() === "lead") });
  }
  return { rows, rejected };
}

export interface Person { email: string; rollNo: string | null; userId: string | null }

/** Match each row to someone by SNU mail ID, then roll number. Unmatched rows come back in `unknown`. */
export function matchGroupSheet(rows: GroupSheetRow[], people: Person[]) {
  const byEmail = new Map(people.map((p) => [p.email, p]));
  const byRoll = new Map(people.flatMap((p) => (p.rollNo ? [[p.rollNo, p] as const] : [])));
  const matched: { group: string; person: Person; lead: boolean }[] = [];
  const unknown: string[] = [];
  for (const r of rows) {
    const person = (r.email && byEmail.get(r.email)) || (r.rollNo && byRoll.get(r.rollNo)) || null;
    if (person) matched.push({ group: r.group, person, lead: r.lead });
    else unknown.push(`${r.group}: ${r.email ?? r.rollNo}`);
  }
  return { matched, unknown };
}
