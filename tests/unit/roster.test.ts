import { describe, expect, it } from "vitest";
import { parseRoster } from "@/lib/roster";

describe("parseRoster", () => {
  it("imports valid lines, skips the header, and rejects bad roll numbers", () => {
    const { entries, rejected } = parseRoster([
      "email,name,roll_no",
      "Asha@snu.edu.in,Asha Rao,2610110014",
      "lead@snu.edu.in,Core Lead,2310110600,admin",
      "noroll@snu.edu.in,No Roll",
      "short@snu.edu.in,Short,261011001",
      "long@snu.edu.in,Long,26101100140",
      "wrong@snu.edu.in,Wrong,1610110014",
      "letters@snu.edu.in,Letters,21BCE001",
      "not-an-email,Someone,2610110015",
      "num@snu.edu.in,Agent 47,2610110016",
      "Ravi2 Kumar 2610110017 rk1@snu.edu.in",
    ].join("\n"));
    expect(entries).toEqual([
      { email: "asha@snu.edu.in", name: "Asha Rao", rollNo: "2610110014", role: "member" },
      { email: "lead@snu.edu.in", name: "Core Lead", rollNo: "2310110600", role: "admin" },
      { email: "noroll@snu.edu.in", name: "No Roll", rollNo: null, role: "member" },
    ]);
    expect(rejected).toEqual([
      "short@snu.edu.in,Short,261011001",
      "long@snu.edu.in,Long,26101100140",
      "wrong@snu.edu.in,Wrong,1610110014",
      "letters@snu.edu.in,Letters,21BCE001",
      "not-an-email,Someone,2610110015",
      "num@snu.edu.in,Agent 47,2610110016",
      "Ravi2 Kumar 2610110017 rk1@snu.edu.in",
    ]);
  });

  it("reads Excel rows of name, roll no, SNU ID separated by tabs or spaces", () => {
    const { entries, rejected } = parseRoster([
      "Name\tRoll No\tSNU ID",
      "Aayush Digikar\t2610110014\tad712@snu.edu.in",
      "pranik reddy manne 2610110353 mr410@snu.edu.in",
      "SHIVANSH kalra 2310110600 sk262@snu.edu.in admin",
      "Arnav Singh 2610110121 as608@snu.in",
    ].join("\n"), "snu.edu.in");
    expect(entries).toEqual([
      { email: "ad712@snu.edu.in", name: "Aayush Digikar", rollNo: "2610110014", role: "member" },
      { email: "mr410@snu.edu.in", name: "Pranik Reddy Manne", rollNo: "2610110353", role: "member" },
      { email: "sk262@snu.edu.in", name: "Shivansh Kalra", rollNo: "2310110600", role: "admin" },
    ]);
    expect(rejected).toEqual(["Arnav Singh 2610110121 as608@snu.in"]);
  });

  it("skips repeated emails and roll numbers, and roll numbers owned by someone else", () => {
    const { entries, duplicates } = parseRoster([
      "Asha Rao 2610110014 asha@snu.edu.in",
      "Asha Again 2610110099 ASHA@snu.edu.in",
      "Same Roll 2610110014 other@snu.edu.in",
      "Taken Roll 2610110050 new@snu.edu.in",
      "Old Member 2610110060 old@snu.edu.in",
    ].join("\n"), "snu.edu.in", [
      { email: "owner@snu.edu.in", rollNo: "2610110050" },
      { email: "old@snu.edu.in", rollNo: "2610110060" },
    ]);
    expect(entries.map((e) => e.email)).toEqual(["asha@snu.edu.in", "old@snu.edu.in"]);
    expect(duplicates).toEqual([
      "Asha Again 2610110099 ASHA@snu.edu.in",
      "Same Roll 2610110014 other@snu.edu.in",
      "Taken Roll 2610110050 new@snu.edu.in",
    ]);
  });
});
