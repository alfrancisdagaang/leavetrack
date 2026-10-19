import { describe, expect, it } from "vitest";
import { parseOrgPage } from "./org-hr-parse";

const person = { id: "u1", name: "Marco Santos", role: "manager", reports: 2 };
const ok = (data: unknown) => ({ success: true, data });
const page = { total: 1, page: 1, pageSize: 50, people: [person] };

describe("parseOrgPage (TASK-064)", () => {
  it("accepts the documented envelope", () => {
    expect(parseOrgPage(ok(page))).toEqual(page);
  });

  it("drops fields the page does not use: nothing else of a person is kept", () => {
    const out = parseOrgPage(ok({ ...page, people: [{ ...person, email: "x@y.example" }] }));
    expect(out?.people[0]).toEqual(person);
  });

  it("accepts an empty page", () => {
    expect(parseOrgPage(ok({ total: 0, page: 1, pageSize: 50, people: [] }))?.people).toEqual([]);
  });

  it.each([
    ["null", null],
    ["a string", "nope"],
    ["an error envelope", { success: false, error: { code: "FORBIDDEN", message: "no" } }],
    ["no data", { success: true }],
    ["null data", { success: true, data: null }],
    ["a negative total", ok({ ...page, total: -1 })],
    ["a fractional total", ok({ ...page, total: 1.5 })],
    ["page 0", ok({ ...page, page: 0 })],
    ["people not an array", ok({ ...page, people: "x" })],
    ["a person with no id", ok({ ...page, people: [{ ...person, id: undefined }] })],
    ["a person with an unknown role", ok({ ...page, people: [{ ...person, role: "admin" }] })],
    ["a person with negative reports", ok({ ...page, people: [{ ...person, reports: -1 }] })],
    ["one bad person among good ones", ok({ ...page, people: [person, 5] })],
  ])("rejects %s", (_name, json) => {
    expect(parseOrgPage(json)).toBeNull();
  });
});
