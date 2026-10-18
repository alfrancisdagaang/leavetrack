import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateField } from "@/components/ui/date-field";

const render = (over: Partial<ComponentProps<typeof DateField>> = {}) =>
  renderToStaticMarkup(
    createElement(DateField, {
      id: "end_date",
      label: "End date",
      value: "",
      onChange: () => {},
      ...over,
    }),
  );

describe("DateField", () => {
  it("is a labelled native date input with the Figma calendar icon", () => {
    const out = render();
    expect(out).toContain('<label for="end_date"');
    expect(out).toContain('id="end_date"');
    expect(out).toContain('type="date"');
    expect(out).toContain("required");
    expect(out).toContain("calendar-days.svg");
  });

  it("makes the browser's own icon invisible and clickable over the whole field", () => {
    const out = render();
    expect(out).toContain("[&amp;::-webkit-calendar-picker-indicator]:opacity-0");
    expect(out).toContain("[&amp;::-webkit-calendar-picker-indicator]:inset-0");
    expect(out).toContain("pointer-events-none");
  });

  it("passes min and value through", () => {
    const out = render({ min: "2026-11-02", value: "2026-11-04" });
    expect(out).toContain('min="2026-11-02"');
    expect(out).toContain('value="2026-11-04"');
    expect(render({ min: "" })).not.toContain("min=");
  });

  it("links the hint, and the error as an alert with aria-invalid", () => {
    const out = render({ hint: "Must not be before the start date.", error: "End date is wrong." });
    expect(out).toContain('id="end_date-hint"');
    expect(out).toContain('id="end_date-error"');
    expect(out).toContain('role="alert"');
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain('aria-describedby="end_date-hint end_date-error"');
    expect(out).toContain("border-event-rejected");
    expect(out).toContain("circle-alert.svg");
  });

  it("has no error markup and a normal border when there is no error", () => {
    const out = render({ hint: "Hint" });
    expect(out).not.toContain("aria-invalid");
    expect(out).not.toContain('role="alert"');
    expect(out).toContain("border-ink-muted");
    expect(out).toContain('aria-describedby="end_date-hint"');
  });
});
