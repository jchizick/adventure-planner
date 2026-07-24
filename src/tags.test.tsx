// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { curatedTags, normalizeTagSlugs, tagIdsForSlugs } from "./tag-model";
import { TagList, TagSelector } from "./tags";

afterEach(cleanup);

describe("curated tag definitions", () => {
  it("keeps six stable, uniquely ordered IDs and slugs", () => {
    expect(curatedTags.map((tag) => tag.slug)).toEqual([
      "date-night",
      "friends-family",
      "archie-friendly",
      "seasonal",
      "rainy-day",
      "recurring",
    ]);
    expect(new Set(curatedTags.map((tag) => tag.id)).size).toBe(6);
    expect(new Set(curatedTags.map((tag) => tag.slug)).size).toBe(6);
    expect(curatedTags.map((tag) => tag.sortOrder)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("normalizes legacy labels, removes unknowns and duplicates, and maps stable IDs", () => {
    expect(normalizeTagSlugs([
      "Rainy Day",
      "date-night",
      "Date Night",
      "unknown",
    ])).toEqual(["date-night", "rainy-day"]);
    expect(tagIdsForSlugs(["seasonal", "seasonal"])).toEqual([
      "00000000-0000-4000-8000-000000000004",
    ]);
  });
});

describe("tag controls and compact display", () => {
  it("supports multi-select with semantic pressed state and a visible check", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TagSelector value={[]} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Date Night" }));
    expect(onChange).toHaveBeenLastCalledWith(["date-night"]);

    rerender(
      <TagSelector value={["date-night"]} onChange={onChange} />,
    );
    const selected = screen.getByRole("button", { name: "Date Night" });
    expect(selected.getAttribute("aria-pressed")).toBe("true");
    expect(selected.querySelector(".tag-selected-check")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Seasonal" }));
    expect(onChange).toHaveBeenLastCalledWith(["date-night", "seasonal"]);
  });

  it("caps card tags at two and reports the exact overflow count", () => {
    render(
      <TagList
        tags={["date-night", "seasonal", "recurring", "rainy-day"]}
        limit={2}
      />,
    );
    expect(screen.getByText("Date Night")).toBeTruthy();
    expect(screen.getByText("Seasonal")).toBeTruthy();
    expect(screen.getByLabelText("2 more tags").textContent).toBe("+2");
    expect(screen.queryByText("Recurring")).toBeNull();
  });
});
