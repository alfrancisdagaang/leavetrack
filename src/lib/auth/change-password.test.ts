import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const logs = vi.hoisted(() => ({ lines: [] as string[] }));
vi.mock("@/lib/logger", () => {
  const record = (...args: unknown[]) => void logs.lines.push(JSON.stringify(args));
  return { logger: { warn: record, error: record, info: record } };
});

const state = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => state.client }));

const { changePassword } = await import("@/lib/auth/change-password");

const EMAIL = "elena.cruz@leavetrack.example";
const OLD = "OldPass-Secret1";
const NEW = "NewPass-Secret2";

/** A fake Supabase Auth: one account, three endpoints, every call recorded. */
let server: Server;
let url = "";
let password = OLD;
let calls: string[] = [];
let failure: { path: string; status: number; code: string } | null = null;

function readBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    let text = "";
    req.on("data", (c) => (text += c));
    req.on("end", () => resolve(text ? JSON.parse(text) : {}));
  });
}

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url ?? "", "http://x");
    const body = await readBody(req);
    const label = `${req.method} ${pathname}${searchParams.get("scope") ? `?scope=${searchParams.get("scope")}` : ""}`;
    calls.push(label);
    const send = (status: number, json: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    };
    if (failure && pathname.endsWith(failure.path)) {
      return send(failure.status, { code: failure.code, error_code: failure.code, msg: "x" });
    }
    const user = {
      id: "auth-1",
      email: EMAIL,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    };
    if (pathname === "/auth/v1/token") {
      if (body.email === EMAIL && body.password === password) {
        return send(200, {
          access_token: "tok",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "ref",
          user,
        });
      }
      return send(400, {
        code: 400,
        error_code: "invalid_credentials",
        msg: "Invalid login credentials",
      });
    }
    if (pathname === "/auth/v1/user" && req.method === "PUT") {
      password = body.password ?? password;
      return send(200, user);
    }
    if (pathname === "/auth/v1/logout") {
      res.writeHead(204);
      return res.end();
    }
    return send(404, {});
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => void server.close());

beforeEach(() => {
  password = OLD;
  calls = [];
  failure = null;
  logs.lines.length = 0;
  state.client = createClient(url, "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
});

const signInWith = async (pw: string) => {
  const probe = createClient(url, "anon-key", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return (await probe.auth.signInWithPassword({ email: EMAIL, password: pw })).error;
};
const rejection = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e as AppError,
  );

describe("changePassword against a fake Auth server (TASK-065)", () => {
  it("AC1: re-checks the current password, sets the new one, signs out other sessions, in that order", async () => {
    await changePassword(EMAIL, OLD, NEW);
    expect(calls).toEqual([
      "POST /auth/v1/token",
      "PUT /auth/v1/user",
      "POST /auth/v1/logout?scope=others",
    ]);
  });

  it("AC1: afterwards the new password signs in and the old one does not", async () => {
    await changePassword(EMAIL, OLD, NEW);
    expect(await signInWith(NEW)).toBeNull();
    expect((await signInWith(OLD))?.code).toBe("invalid_credentials");
  });

  it("AC2: a wrong current password is one generic 400 and the password stays as it was", async () => {
    const err = await rejection(changePassword(EMAIL, "Wrong-Guess-9", NEW));
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Your current password is incorrect.",
    });
    expect(calls).toEqual(["POST /auth/v1/token"]);
    expect(await signInWith(OLD)).toBeNull();
  });

  it("AC2: Supabase's weak-password answer becomes an inline 400", async () => {
    failure = { path: "/user", status: 422, code: "weak_password" };
    const err = await rejection(changePassword(EMAIL, OLD, NEW));
    expect(err).toMatchObject({ code: "VALIDATION_ERROR" });
    expect((err as AppError).message).toContain("too weak");
    expect(calls).not.toContain("POST /auth/v1/logout?scope=others");
  });

  it("an Auth outage while re-checking or updating is a 503, never a changed password", async () => {
    failure = { path: "/token", status: 500, code: "unexpected_failure" };
    expect(await rejection(changePassword(EMAIL, OLD, NEW))).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    failure = { path: "/user", status: 500, code: "unexpected_failure" };
    expect(await rejection(changePassword(EMAIL, OLD, NEW))).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(await signInWith(OLD)).toBeNull();
  });

  it("failing to sign out the other sessions does not fail the change (it is already done)", async () => {
    failure = { path: "/logout", status: 500, code: "unexpected_failure" };
    await expect(changePassword(EMAIL, OLD, NEW)).resolves.toBeUndefined();
    expect(await signInWith(NEW)).toBeNull();
    expect(logs.lines.join("")).toContain("other sessions were not signed out");
  });

  it("without Supabase configured it is a 503", async () => {
    state.client = null;
    expect(await rejection(changePassword(EMAIL, OLD, NEW))).toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("AC4: no password reaches a log line, on success or on any failure", async () => {
    await changePassword(EMAIL, OLD, NEW);
    await rejection(changePassword(EMAIL, "Wrong-Guess-9", NEW));
    failure = { path: "/user", status: 422, code: "weak_password" };
    await rejection(changePassword(EMAIL, OLD, NEW));
    failure = { path: "/logout", status: 500, code: "x" };
    await rejection(changePassword(EMAIL, OLD, NEW));
    const text = logs.lines.join("\n");
    for (const secret of [OLD, NEW, "Wrong-Guess-9"]) expect(text).not.toContain(secret);
  });
});
