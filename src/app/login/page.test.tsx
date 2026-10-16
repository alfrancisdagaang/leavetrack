import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors/app-error";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ ALLOW_MOCK_LOGIN: false }) }));
vi.mock("@/app/login/login-view", () => ({ LoginView: () => null }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  unstable_rethrow: (err: unknown) => {
    if ((err as { digest?: string }).digest) throw err;
  },
}));

const { default: LoginPage } = await import("@/app/login/page");
const props = { searchParams: Promise.resolve({}) };

beforeEach(() => {
  mocks.getSession.mockReset();
  mocks.redirect.mockClear();
});

describe("LoginPage", () => {
  it("shows the form when the session cannot be checked right now", async () => {
    mocks.getSession.mockRejectedValue(new AppError("SERVICE_UNAVAILABLE", "down"));
    await expect(LoginPage(props)).resolves.toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("still moves a signed-in person on to the app", async () => {
    mocks.getSession.mockResolvedValue({ role: "employee", user: {} });
    await expect(LoginPage(props)).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("lets Next's own control-flow errors through", async () => {
    mocks.getSession.mockRejectedValue(Object.assign(new Error("dyn"), { digest: "X" }));
    await expect(LoginPage(props)).rejects.toThrow("dyn");
  });
});
