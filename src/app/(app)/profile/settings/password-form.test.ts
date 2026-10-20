import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasswordForm } from "./password-form";

const html = renderToStaticMarkup(createElement(PasswordForm));
const source = readFileSync(new URL("./password-form.tsx", import.meta.url), "utf8");

describe("PasswordForm (TASK-065 AC5)", () => {
  it("has three labelled password fields with the right autocomplete hints", () => {
    for (const [id, label] of [
      ["current-password", "Current password"],
      ["new-password", "New password"],
      ["confirm-password", "Confirm new password"],
    ]) {
      expect(html).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${label}</label>`));
      expect(html).toMatch(new RegExp(`<input[^>]*id="${id}"[^>]*type="password"`));
    }
    expect(html).toMatch(/id="current-password"[^>]*autoComplete="current-password"/i);
    expect(html.match(/autoComplete="new-password"/gi)).toHaveLength(2);
  });

  it("states the length rule up front and shows no message before anything happens", () => {
    expect(html).toContain("8 to 72 characters.");
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it("has a submit button, no sideways scroll risk (single column, bounded width)", () => {
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Change password<\/button>/);
    expect(html).toContain("grid-cols-1");
    expect(html).toContain("max-w-md");
  });

  it("posts only to the same-origin route and keeps passwords in memory", () => {
    expect(source).toContain('fetch("/api/account/password"');
    expect(source).not.toMatch(/localStorage|sessionStorage|document\.cookie|console\./);
  });

  it("announces failure with role=alert (Alert) and success with role=status", () => {
    expect(source).toContain('<Alert variant="error"');
    expect(source).toContain('role="status"');
  });
});
