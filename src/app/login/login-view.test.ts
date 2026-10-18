import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LoginView } from "@/app/login/login-view";

// The forms only wire server actions; the actions themselves are tested in actions.test.ts.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("@/app/login/actions", () => ({
  loginAction: async () => ({ error: null }),
  mockLoginAction: async () => ({ error: null }),
}));

const render = (allowMock: boolean, next?: string) =>
  renderToStaticMarkup(createElement(LoginView, { allowMock, next }));

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

  it("has one h1, the page's only heading level one, and a welcome line", () => {
    const html = render(false);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Sign in<\/h1>/);
    expect(html).toContain("Welcome back. Please sign in to continue.");
  });

  it("shows the logo and the name, the brand panel copy, and the way to get access", () => {
    const html = render(false);
    expect(html).toContain("/icons/logo.svg");
    expect(html).toContain("LeaveTrack");
    expect(html).toContain("Simple leave tracking for a healthier, more balanced team.");
    expect(html).toContain("Need access? Ask HR to add your email.");
  });

  it("keeps the password input a plain hidden password named password, with a labelled toggle", () => {
    const html = render(false);
    expect(html).toMatch(/<input[^>]*id="password"[^>]*type="password"/);
    expect(html).toMatch(/<input[^>]*name="password"/);
    expect(html).toMatch(/<input[^>]*required/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-label="Show password"/);
    expect(html).toMatch(/aria-pressed="false"/);
  });

  it("never puts credentials or a demo account in the page", () => {
    for (const allowMock of [false, true]) {
      const html = render(allowMock);
      expect(html).not.toMatch(/demo123|hr@demo|password:/i);
      expect(html).not.toMatch(/value="[^"]*@[^"]*"/); // no prefilled email
    }
  });

  it("is a split layout from lg and a single column below it, with no hard-coded colours", () => {
    const html = render(false);
    expect(html).toContain("lg:grid-cols-2");
    expect(html).toMatch(/<aside[^>]*class="[^"]*hidden[^"]*lg:flex/);
    expect(html).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
  });
});
