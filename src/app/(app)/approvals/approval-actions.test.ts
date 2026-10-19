import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

const { ApprovalActions, decisionUrl } = await import("./approval-actions");

describe("decisionUrl", () => {
  it("the manager's route is the default, the HR override route is opt-in (TASK-039)", () => {
    expect(decisionUrl("r1", "decision")).toBe("/api/leave-requests/r1/decision");
    expect(decisionUrl("r1", "override")).toBe("/api/leave-requests/r1/override");
  });
});

describe("ApprovalActions labels", () => {
  const render = (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      createElement(ApprovalActions, { requestId: "r1", canApprove: true, ...props }),
    );

  it("keeps the manager's Approve and Reject unchanged by default", () => {
    const out = render();
    expect(out).toContain(">Approve<");
    expect(out).toContain(">Reject<");
  });

  it("AC1: with showApprove off only Reject is offered (not a disabled Approve)", () => {
    const out = render({ showApprove: false });
    expect(out).toContain(">Reject<");
    expect(out).not.toContain(">Approve<");
    // No disabled button at all (the class names mention `disabled:` variants, so check the attribute).
    expect(out).not.toContain('disabled=""');
  });

  it("shows HR's own approve label when one is given", () => {
    const out = render({ endpoint: "override", approveLabel: "Approve override" });
    expect(out).toContain(">Approve override<");
    expect(out).not.toContain(">Approve<");
  });
});
