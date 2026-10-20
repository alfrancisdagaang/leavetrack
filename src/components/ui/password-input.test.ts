import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "@/components/ui/password-input";

const render = (props: Partial<Parameters<typeof PasswordInput>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(PasswordInput, {
      id: "new-password",
      name: "new_password",
      label: "New password",
      autoComplete: "new-password",
      ...props,
    }),
  );

describe("PasswordInput (TASK-065 AC5)", () => {
  it("is a labelled password input with the given name and autocomplete", () => {
    const html = render();
    expect(html).toMatch(/<label[^>]*for="new-password"[^>]*>New password<\/label>/);
    expect(html).toMatch(/<input[^>]*id="new-password"[^>]*type="password"/);
    expect(html).toContain('name="new_password"');
    expect(html).toMatch(/autoComplete="new-password"|autocomplete="new-password"/i);
  });

  it("starts hidden, with a named 44px toggle that is not a submit button", () => {
    const html = render();
    expect(html).toContain('aria-label="Show new password"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-controls="new-password"');
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain("size-11");
  });

  it("ties a hint and an error to the input and marks it invalid", () => {
    const html = render({ hint: "8 to 72 characters.", error: "Too short." });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="new-password-hint new-password-error"');
    expect(html).toMatch(/<p[^>]*id="new-password-error"[^>]*role="alert"/);
  });

  it("has no aria-invalid or describedby when there is nothing to say", () => {
    const html = render();
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
  });
});
