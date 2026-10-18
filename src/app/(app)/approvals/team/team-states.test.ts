import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TeamEmpty, TeamError } from "./team-states";

describe("TeamError (US-12 AC5)", () => {
  const out = renderToStaticMarkup(TeamError());

  it("announces the problem and offers a Try again link outside the alert", () => {
    expect(out).toContain('role="alert"');
    expect(out).toContain("Your team could not be loaded right now.");
    expect(out).toContain("Try again in a moment.");
    expect(out).toMatch(/<a [^>]*href="\/approvals\/team"[^>]*>Try again<\/a>/);
    const alert = out.slice(
      out.indexOf('role="alert"'),
      out.indexOf("</div>", out.indexOf('role="alert"')),
    );
    expect(alert).not.toContain("<a ");
  });

  it("uses tokens only", () => {
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(|style="(?!color:transparent")/);
  });
});

describe("TeamEmpty (US-12 AC3)", () => {
  const out = renderToStaticMarkup(TeamEmpty());

  it("says there are no direct reports, with an icon, and is not an alert", () => {
    expect(out).toContain("You have no direct reports yet.");
    expect(out).toContain("users-card.svg");
    expect(out).not.toContain('role="alert"');
  });
});
