import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LoginView } from "@/app/login/login-view";

// The forms only wire server actions; the actions themselves are tested in actions.test.ts.
vi.mock("@/app/login/actions", () => ({
  loginAction: async () => ({ error: null }),
  mockLoginAction: async () => ({ error: null }),
}));

const render = (allowMock: boolean, next?: string) =>
  renderToStaticMarkup(<LoginView allowMock={allowMock} next={next} />);

describe("LoginView", () => {
  it("AC5: does not render the mock form when the flag is off", () => {
    const html = render(false);
    expect(html).not.toMatch(/mock/i);
    expect(html).not.toContain('name="role"');
  });

  it("AC5: renders the mock form, labelled as a mock, when the flag is on", () => {
    const html = render(true);
    expect(html).toContain("Demo only: mock sign-in");
    expect(html).toContain("Not real authentication");
    expect(html).toContain('name="role"');
  });

  it("has a labelled email and a labelled password input of the right types", () => {
    const html = render(false);
    expect(html).toMatch(/<label[^>]*for="email"[^>]*>Email<\/label>/);
    expect(html).toMatch(/<label[^>]*for="password"[^>]*>Password<\/label>/);
    expect(html).toMatch(/<input[^>]*id="email"[^>]*type="email"/);
    expect(html).toMatch(/<input[^>]*id="password"[^>]*type="password"/);
    expect(html).toMatch(/autocomplete="current-password"/i);
  });

  it("labels every input on the page when the mock form is shown too", () => {
    const html = render(true);
    const ids = [...html.matchAll(/<(?:input|select)[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(5);
    for (const id of ids) expect(html).toContain(`for="${id}"`);
  });

  it("carries the next path into both forms and shows no error before a submit", () => {
    const html = render(true, "/approvals");
    expect(html.match(/name="next" value="\/approvals"/g)).toHaveLength(2);
    expect(html).not.toContain('role="alert"');
  });
});
