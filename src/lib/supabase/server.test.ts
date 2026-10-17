import { beforeEach, describe, expect, it, vi } from "vitest";

const ssr = vi.hoisted(() => ({ options: undefined as { cookieOptions?: object } | undefined }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookieOptions?: object }) => {
    ssr.options = options;
    return {};
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    APP_ENV: "staging",
    NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  }),
}));

const { createSupabaseServerClient } = await import("@/lib/supabase/server");

beforeEach(() => {
  ssr.options = undefined;
  vi.stubEnv("NODE_ENV", "production");
});

describe("createSupabaseServerClient", () => {
  it("TASK-025 AC2: asks for httpOnly, Secure session cookies instead of the library defaults", async () => {
    await createSupabaseServerClient();
    expect(ssr.options?.cookieOptions).toEqual({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
    });
  });
});
