import { describe, expect, it } from "vitest";
import { matchGroupSheet, parseGroupSheet } from "@/lib/group-sheet";

describe("parseGroupSheet", () => {
  it("reads team, SNU mail ID or roll number, and an optional lead, from tabs or commas", () => {
    const { rows, rejected } = parseGroupSheet([
      "Team\tEmail\tRole",
      "Marketing\tAsha@snu.edu.in\tlead",
      "Marketing,2610110015",
      "  Event   Crew ,ravi@snu.edu.in",
      "Marketing\tnobody",
      "\tfloating@snu.edu.in",
    ].join("\n"));
    expect(rows).toEqual([
      { group: "Marketing", email: "asha@snu.edu.in", rollNo: null, lead: true },
      { group: "Marketing", email: null, rollNo: "2610110015", lead: false },
      { group: "Event Crew", email: "ravi@snu.edu.in", rollNo: null, lead: false },
    ]);
    expect(rejected).toEqual(["Marketing\tnobody", "floating@snu.edu.in"]);
  });
});

describe("matchGroupSheet", () => {
  it("matches by mail ID then roll number and reports the rest", () => {
    const people = [
      { email: "asha@snu.edu.in", rollNo: "2610110014", userId: "u1" },
      { email: "ravi@snu.edu.in", rollNo: "2610110015", userId: null },
    ];
    const { matched, unknown } = matchGroupSheet([
      { group: "A", email: "asha@snu.edu.in", rollNo: null, lead: true },
      { group: "A", email: null, rollNo: "2610110015", lead: false },
      { group: "B", email: "who@snu.edu.in", rollNo: null, lead: false },
    ], people);
    expect(matched.map((m) => [m.group, m.person.email, m.lead])).toEqual([["A", "asha@snu.edu.in", true], ["A", "ravi@snu.edu.in", false]]);
    expect(unknown).toEqual(["B: who@snu.edu.in"]);
  });
});
