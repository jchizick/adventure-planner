import { describe, expect, it } from "vitest";
import { selectRecentIdeas } from "./recent-ideas";
import type { Idea } from "./types";

function idea(id: string, createdAt: string): Idea {
  return {
    id,
    title: `Idea ${id}`,
    description: "",
    category: "culture",
    status: "Idea",
    tags: [],
    addedBy: "Member",
    isDateNight: false,
    createdAt,
  };
}

describe("selectRecentIdeas", () => {
  it("selects the latest three by authoritative creation timestamp", () => {
    const result = selectRecentIdeas([
      idea("oldest", "2026-07-10T12:00:00Z"),
      idea("newest", "2026-07-14T12:00:00Z"),
      idea("fourth", "2026-07-11T12:00:00Z"),
      idea("second", "2026-07-13T12:00:00Z"),
      idea("third", "2026-07-12T12:00:00Z"),
    ]);

    expect(result.map((entry) => entry.id)).toEqual([
      "newest",
      "second",
      "third",
    ]);
  });

  it("uses ID as a deterministic secondary sort without mutating provider state", () => {
    const providerIdeas = [
      idea("charlie", "2026-07-14T12:00:00Z"),
      idea("alpha", "2026-07-14T12:00:00Z"),
      idea("bravo", "2026-07-14T12:00:00Z"),
    ];
    const originalOrder = [...providerIdeas];

    expect(selectRecentIdeas(providerIdeas).map((entry) => entry.id)).toEqual([
      "alpha",
      "bravo",
      "charlie",
    ]);
    expect(providerIdeas).toEqual(originalOrder);
  });

  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 3],
  ])("returns %i available Ideas as %i cards", (available, expected) => {
    const providerIdeas = Array.from({ length: available }, (_, index) =>
      idea(`idea-${index}`, `2026-07-${String(index + 10).padStart(2, "0")}T12:00:00Z`),
    );

    expect(selectRecentIdeas(providerIdeas)).toHaveLength(expected);
  });

  it("places a newly created Idea first immediately", () => {
    const existing = [
      idea("older", "2026-07-13T12:00:00Z"),
      idea("oldest", "2026-07-12T12:00:00Z"),
    ];
    const created = idea("created-now", "2026-07-15T12:00:00Z");

    expect(selectRecentIdeas([created, ...existing])[0]).toBe(created);
  });

  it("fills a deleted recent Idea's slot with the fourth-most-recent", () => {
    const providerIdeas = [
      idea("first", "2026-07-15T12:00:00Z"),
      idea("second", "2026-07-14T12:00:00Z"),
      idea("third", "2026-07-13T12:00:00Z"),
      idea("fourth", "2026-07-12T12:00:00Z"),
    ];

    const afterDelete = providerIdeas.filter((entry) => entry.id !== "second");
    expect(selectRecentIdeas(afterDelete).map((entry) => entry.id)).toEqual([
      "first",
      "third",
      "fourth",
    ]);
  });
});
