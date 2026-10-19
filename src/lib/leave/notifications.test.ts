import type { Sql } from "postgres";
import { describe, expect, it } from "vitest";
import {
  listNotifications,
  markNotificationsRead,
  NOTIFICATION_PAGE_SIZE,
} from "@/lib/leave/notifications";

const ELENA = "00000000-0000-4000-8000-000000000003";
const REQ = "30000000-0000-4000-8000-000000000001";
const N1 = "40000000-0000-4000-8000-000000000001";

type Call = { text: string; values: unknown[] };

/** A fake postgres.js client: records every statement and answers with one scripted row. */
function fakeSql(row: unknown) {
  const calls: Call[] = [];
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(row === undefined ? [] : [row]);
  }) as unknown as Sql;
  return { sql, calls };
}

const ITEM = {
  id: N1,
  kind: "submitted",
  created_at: "2026-10-20T08:00:00.123456+00:00",
  read_at: null,
  request_id: REQ,
  employee_name: "Elena Cruz",
  leave_type_name: "Vacation",
  start_date: "2026-11-02",
  end_date: "2026-11-03",
  request_removed: false,
};

describe("listNotifications (TASK-054, AC1 and AC4)", () => {
  it("AC4: is ONE statement, scoped to the session user in the SQL", async () => {
    const { sql, calls } = fakeSql({ unread: 1, items: [ITEM] });
    await listNotifications(sql, ELENA);
    expect(calls).toHaveLength(1);
    // Two uses of the id (the count and the list), and the page size as a value.
    expect(calls[0]!.values).toEqual([ELENA, ELENA, NOTIFICATION_PAGE_SIZE]);
    expect(calls[0]!.text).toMatch(/where recipient_id = \? and read_at is null/);
    expect(calls[0]!.text).toMatch(/where n\.recipient_id = \?/);
  });

  it("AC1: newest first, capped at 20, and never selects the reason or a decision note", async () => {
    const { sql, calls } = fakeSql({ unread: 0, items: [] });
    await listNotifications(sql, ELENA);
    const text = calls[0]!.text;
    expect(NOTIFICATION_PAGE_SIZE).toBe(20);
    expect(text).toMatch(/order by n\.created_at desc, n\.id desc limit \?/);
    expect(text).not.toMatch(/reason|decision_note/);
  });

  it("does not filter out a removed request: it is flagged instead", async () => {
    const { sql, calls } = fakeSql({
      unread: 0,
      items: [{ ...ITEM, request_removed: true, read_at: "2026-10-20T09:00:00+00:00" }],
    });
    const result = await listNotifications(sql, ELENA);
    expect(calls[0]!.text).not.toMatch(/is_deleted\s*=\s*false/);
    expect(result.notifications[0]).toMatchObject({
      requestRemoved: true,
      readAt: "2026-10-20T09:00:00+00:00",
    });
  });

  it("maps a row to the view, with dates as text", async () => {
    const { sql } = fakeSql({ unread: 3, items: [ITEM] });
    expect(await listNotifications(sql, ELENA)).toEqual({
      unread: 3,
      notifications: [
        {
          id: N1,
          kind: "submitted",
          createdAt: "2026-10-20T08:00:00.123456+00:00",
          readAt: null,
          requestId: REQ,
          employeeName: "Elena Cruz",
          leaveTypeName: "Vacation",
          startDate: "2026-11-02",
          endDate: "2026-11-03",
          requestRemoved: false,
        },
      ],
    });
  });

  it("an empty result is zero unread and an empty list", async () => {
    expect(await listNotifications(fakeSql(undefined).sql, ELENA)).toEqual({
      unread: 0,
      notifications: [],
    });
  });
});

describe("markNotificationsRead (TASK-054, AC2 and AC4)", () => {
  it("AC4: is ONE statement, scoped to the session user, and only touches unread rows", async () => {
    const { sql, calls } = fakeSql({ marked: 2, unread: 0 });
    await markNotificationsRead(sql, ELENA);
    expect(calls).toHaveLength(1);
    const text = calls[0]!.text;
    expect(text).toMatch(/^with marked as \( update public\.notifications set read_at = now\(\)/);
    expect(text).toMatch(/where recipient_id = \? and read_at is null/);
    expect(text).toMatch(/n\.recipient_id = \? and n\.read_at is null/);
  });

  it("AC2: no id marks all (a null id); an id marks only that one", async () => {
    const all = fakeSql({ marked: 2, unread: 0 });
    await markNotificationsRead(all.sql, ELENA);
    expect(all.calls[0]!.values).toEqual([ELENA, null, null, ELENA]);

    const one = fakeSql({ marked: 1, unread: 1 });
    expect(await markNotificationsRead(one.sql, ELENA, N1)).toEqual({ marked: 1, unread: 1 });
    expect(one.calls[0]!.values).toEqual([ELENA, N1, N1, ELENA]);
    expect(one.calls[0]!.text).toMatch(/\?::uuid is null or id = \?::uuid/);
  });

  it("the id is a parameter, never part of the SQL text", async () => {
    const { sql, calls } = fakeSql({ marked: 0, unread: 0 });
    await markNotificationsRead(sql, ELENA, N1);
    expect(calls[0]!.text).not.toContain(N1);
    expect(calls[0]!.text).not.toContain(ELENA);
  });

  it("an empty result is zero marked and zero unread", async () => {
    expect(await markNotificationsRead(fakeSql(undefined).sql, ELENA)).toEqual({
      marked: 0,
      unread: 0,
    });
  });
});
