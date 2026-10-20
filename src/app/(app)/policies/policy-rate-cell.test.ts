import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PolicyRateCell, type CellState } from "./policy-rate-cell";

const source = readFileSync(new URL("./policy-rate-cell.tsx", import.meta.url), "utf8");
const noop = () => {};
const render = (cell: Partial<CellState> = {}) =>
  renderToStaticMarkup(
    createElement(PolicyRateCell, {
      id: "rate-u1-t1-t",
      label: "Vacation days a month for Elena Cruz",
      cell: { saved: "1.25", draft: "1.25", status: "idle", message: "", ...cell },
      onDraft: noop,
      onSave: noop,
      onRevert: noop,
    }),
  );

describe("PolicyRateCell (EPIC-13 AC7)", () => {
  it("is a number input named for the person and the type, with the draft as its value", () => {
    const html = render();
    expect(html).toMatch(/<input[^>]*id="rate-u1-t1-t"/);
    expect(html).toContain('type="number"');
    expect(html).toContain('aria-label="Vacation days a month for Elena Cruz"');
    expect(html).toContain('value="1.25"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="31"');
    expect(html).toContain('step="0.01"');
    expect(html).toContain('placeholder="Set rate"');
  });

  it("ties a message region to the input, and shows nothing while idle", () => {
    const html = render();
    expect(html).toContain('aria-describedby="rate-u1-t1-t-message"');
    expect(html).toContain('id="rate-u1-t1-t-message"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain("aria-invalid");
  });

  it("saving: a spinner and 'Saving…' announced as a status", () => {
    const html = render({ status: "busy" });
    expect(html).toContain("loader-circle.svg");
    expect(html).toMatch(/<p[^>]*role="status"[^>]*>Saving…<\/p>/);
  });

  it("saved: a tick and the message announced as a status", () => {
    const html = render({ status: "done", message: "Saved" });
    expect(html).toContain("check-success.svg");
    expect(html).toMatch(/<p[^>]*role="status"[^>]*>Saved<\/p>/);
  });

  it("an error: the input is invalid and the message is an alert, in words (not colour alone)", () => {
    const html = render({ status: "error", message: "Use at most two decimals." });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<p[^>]*role="alert"[^>]*>Use at most two decimals\.<\/p>/);
  });

  it("an empty draft shows the placeholder, not a zero", () => {
    expect(render({ saved: null, draft: "" })).toContain('value=""');
  });

  it("saves on Enter and on leaving the field, reverts on Escape, and has no colour of its own", () => {
    expect(source).toContain('event.key === "Enter"');
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain("onBlur={onSave}");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|style=/);
  });
});
