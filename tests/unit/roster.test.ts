import { describe, expect, it } from "vitest";
import { parseRoster } from "@/lib/roster";

describe("parseRoster", () => {
  it("imports valid lines, skips the header, and rejects bad roll numbers", () => {
    const { entries, rejected } = parseRoster([
      "email,name,roll_no",
      "Asha@snu.edu.in,Asha Rao,24010110104",
      "lead@snu.edu.in,Core Lead,23010110001,admin",
      "noroll@snu.edu.in,No Roll",
      "short@snu.edu.in,Short,2401011010",
      "wrong@snu.edu.in,Wrong,14010110104",
      "letters@snu.edu.in,Letters,21BCE001",
      "not-an-email,Someone,24010110105",
    ].join("\n"));
    expect(entries).toEqual([
      { email: "asha@snu.edu.in", name: "Asha Rao", rollNo: "24010110104", role: "member" },
      { email: "lead@snu.edu.in", name: "Core Lead", rollNo: "23010110001", role: "admin" },
      { email: "noroll@snu.edu.in", name: "No Roll", rollNo: null, role: "member" },
    ]);
    expect(rejected).toEqual([
      "short@snu.edu.in,Short,2401011010",
      "wrong@snu.edu.in,Wrong,14010110104",
      "letters@snu.edu.in,Letters,21BCE001",
      "not-an-email,Someone,24010110105",
    ]);
  });

  it("reads rows pasted from Excel as name, roll no, SNU ID", () => {
    const { entries, rejected } = parseRoster("Name\tRoll No\tSNU ID\nAsha Rao\t24010110104\tAsha@snu.edu.in\nCore Lead\t23010110001\tlead@snu.edu.in\tAdmin\nNo Email\t24010110105\tnoemail");
    expect(entries).toEqual([
      { email: "asha@snu.edu.in", name: "Asha Rao", rollNo: "24010110104", role: "member" },
      { email: "lead@snu.edu.in", name: "Core Lead", rollNo: "23010110001", role: "admin" },
    ]);
    expect(rejected).toEqual(["No Email\t24010110105\tnoemail"]);
  });
});
