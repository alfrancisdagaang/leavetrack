import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BeforeYouSubmitCard } from "@/components/ui/before-you-submit";

const render = (overBalance?: boolean) =>
  renderToStaticMarkup(createElement(BeforeYouSubmitCard, { overBalance }));

describe("BeforeYouSubmitCard", () => {
  it("lists the four guidance lines and the footer, with the info icon", () => {
    const out = render();
    expect(out).toContain("Before you submit");
    expect(out).toContain("Your manager reviews this request. It stays Pending until they decide.");
    expect(out).toContain(
      "Only working days count (Mon to Fri). Public holidays aren&#x27;t excluded yet.",
    );
    expect(out).toContain("Unpaid leave has no balance limit.");
    expect(out).toContain("Track it in Recent activity on your dashboard.");
    expect(out).toContain("info.svg");
    expect(out.match(/<li/g)).toHaveLength(4);
  });

  it("keeps the HR-override wording of the PRD (the decision), not 'can't be approved'", () => {
    const out = render();
    expect(out).toContain(
      "Asking for more than your balance shows a warning. You can still submit it for HR override.",
    );
    expect(out).not.toContain("can&#x27;t be approved");
  });

  it("highlights only the balance line, and only when over balance", () => {
    expect(render(false)).not.toContain("bg-warn-bg");
    const out = render(true);
    expect(out.match(/bg-warn-bg/g)).toHaveLength(1);
    const li = out.split("<li").find((part) => part.includes("HR override")) ?? "";
    expect(li).toContain("bg-warn-bg");
  });

  it("uses a real list and decorative dots", () => {
    const out = render();
    expect(out).toContain("<ul");
    expect(out.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
