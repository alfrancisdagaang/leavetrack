import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FilterShell } from "@/components/ui/filter-shell";
import type { PolicyPerson } from "@/lib/leave/policies";
import { DEFAULT_POLICY_QUERY, type PolicyListQuery } from "@/lib/leave/policies-schema";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
const { PolicyTable } = await import("./policy-table");
const source = readFileSync(new URL("./policy-table.tsx", import.meta.url), "utf8");

const VAC = "10000000-0000-4000-8000-000000000001";
const SICK = "10000000-0000-4000-8000-000000000002";
const people: PolicyPerson[] = [
  {
    id: "u1",
    name: "Elena Cruz",
    managerName: "Marco Santos",
    lastChange: { at: "2026-10-20T01:41:00.000Z", by: "Hana Reyes" },
    rates: [
      { leaveTypeId: VAC, leaveTypeName: "Vacation", rate: "1.25" },
      { leaveTypeId: SICK, leaveTypeName: "Sick", rate: "1.00" },
    ],
  },
  {
    id: "u2",
    name: "Daniel Kim",
    managerName: null,
    lastChange: null,
    rates: [
      { leaveTypeId: VAC, leaveTypeName: "Vacation", rate: null },
      { leaveTypeId: SICK, leaveTypeName: "Sick", rate: "1.00" },
    ],
  },
];
const render = (query: Partial<PolicyListQuery> = {}, list = people) =>
  renderToStaticMarkup(
    createElement(
      FilterShell,
      null,
      createElement(PolicyTable, {
        people: list,
        query: { ...DEFAULT_POLICY_QUERY, ...query },
        timeZone: "Asia/Manila",
      }),
    ),
  );

describe("PolicyTable (EPIC-13 AC1, AC7)", () => {
  const html = render();

  it("is a real table from xl and stacked cards below: two structures, one hidden at each size", () => {
    expect(html).toMatch(/<div class="hidden[^"]*xl:block">\s*<table/);
    expect(html).toMatch(/<ul[^>]*class="[^"]*xl:hidden"/);
    expect(html.match(/aria-label="Employees and their leave policies"/g)).toHaveLength(2);
  });

  it("has column headers with scope, the unit under each rate, a sticky header, and the employee as the row header", () => {
    for (const label of ["Employee", "Vacation", "Sick", "Last changed", "Status"])
      expect(html).toMatch(new RegExp(`<th[^>]*scope="col"[^>]*>(<a[^>]*>)?(<span>)?${label}`));
    expect(html.match(/>days\/month</g)).toHaveLength(2);
    expect(html).toContain("sticky top-0");
    expect(html.match(/<th[^>]*scope="row"/g)).toHaveLength(2);
  });

  it("marks only the sorted column with aria-sort, and gives each sortable header a link", () => {
    expect(html.match(/aria-sort="ascending"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-sort="ascending"[^>]*><a href="\/policies\?dir=desc"/);
    const byVacation = render({ sort: "vacation", dir: "desc" });
    expect(byVacation).toMatch(/aria-sort="descending"[^>]*><a href="\/policies\?sort=vacation"/);
    expect(html).toContain('href="/policies?sort=vacation"');
    expect(html).toContain('href="/policies?sort=sick"');
    expect(html).toContain('href="/policies?sort=changed"');
    // Status is not a sort column
    expect(html).not.toMatch(/<th[^>]*><a[^>]*>Status/);
  });

  it("shows the manager under the name, the last change as 'date by who' or Never", () => {
    expect(html).toContain("Manager: Marco Santos");
    expect(html).toContain("No manager");
    expect(html).toContain("Oct 20, 2026 by Hana Reyes");
    expect(html).toContain("Never");
  });

  it("shows 'Up to date' or 'No policy yet' from the saved rates", () => {
    expect(html).toContain("Up to date");
    expect(html).toContain("No policy yet");
  });

  it("every cell is an input named for the person and the type, once in each structure with its own id", () => {
    for (const [uid, name] of [
      ["u1", "Elena Cruz"],
      ["u2", "Daniel Kim"],
    ])
      for (const [tid, type] of [
        [VAC, "Vacation"],
        [SICK, "Sick"],
      ]) {
        expect(html).toContain(`aria-label="${type} days a month for ${name}"`);
        expect(html).toContain(`id="rate-${uid}-${tid}-t"`);
        expect(html).toContain(`id="rate-${uid}-${tid}-c"`);
      }
    expect(html.match(/<input/g)).toHaveLength(8);
    expect(html).toContain('value="1.25"');
    expect(html).toContain('placeholder="Set rate"');
  });

  it("a leave type filter shows one rate column", () => {
    const one = people.map((p) => ({ ...p, rates: p.rates.slice(0, 1) }));
    const table = render({ type: VAC }, one);
    const head = table.slice(table.indexOf("<thead"), table.indexOf("</thead>"));
    expect(head).toContain("Vacation");
    expect(head).not.toContain("Sick");
    expect(table.match(/<input/g)).toHaveLength(4);
  });

  it("keeps its rows in state, so a save cannot reorder them or remove a row from a filtered list", () => {
    expect(source).toContain("const [rows] = useState(people);");
    expect(source).toContain("useState<Record<string, CellState>>(() =>");
    expect(source).toContain("router.refresh()");
    // the rendered rows never come from the props again
    expect(source.match(/people\.map\(/g)).toBeNull();
    expect(source.match(/rows\.map\(/g)).toHaveLength(3); // the last-change map and the two structures
    expect(source).not.toMatch(/\.sort\(/);
  });

  it("sends one PUT per saved cell with only the two ids and the rate, to the same-origin route", () => {
    expect(source).toContain('fetch("/api/leave-policies"');
    expect(source).toContain('method: "PUT"');
    expect(source).toMatch(
      /user_id: userId,\s*leave_type_id: typeId,\s*accrual_per_month: Number\(typed\)/,
    );
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie|console\./);
  });

  it("uses tokens only: no hex colour, rgb() or inline style", () => {
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|style=/);
  });

  it("has nothing at all to render the table when there are no people", () => {
    expect(render({}, []).match(/<input/g)).toBeNull();
  });
});
