import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasswordField } from "@/app/login/password-field";

describe("PasswordField", () => {
  const html = renderToStaticMarkup(createElement(PasswordField));

  it("is a labelled password input the form posts as `password`", () => {
    expect(html).toMatch(/<label[^>]*for="password"[^>]*>Password<\/label>/);
    expect(html).toMatch(/<input[^>]*id="password"[^>]*type="password"/);
    expect(html).toMatch(/name="password"/);
    expect(html).toMatch(/autoComplete="current-password"|autocomplete="current-password"/i);
  });

  it("starts hidden, with a toggle that says what it will do, not a submit button", () => {
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain('aria-label="Show password"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-controls="password"');
  });

  it("gives the toggle a 44px target and hides the icon from screen readers", () => {
    expect(html).toContain("size-11");
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
});
