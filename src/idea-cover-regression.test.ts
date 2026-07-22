import { describe, expect, it } from "vitest";
import pagesSource from "./pages.tsx?raw";
import { emptyAdvancedIdeaFilters, filterIdeas } from "./idea-model";
import type { Idea } from "./types";

function idea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "idea-id",
    title: "Gallery afternoon",
    description: "New exhibition",
    category: "culture",
    status: "Tentative",
    tags: ["art"],
    addedBy: "Member",
    addedByUserId: "user-id",
    isDateNight: false,
    createdAt: "2026-07-15T12:00:00Z",
    coverPresetId: "culture-gallery",
    ...overrides,
  };
}

describe("Idea cover workflow regressions", () => {
  it("does not affect search, status, or scheduling filters", () => {
    const ideas = [
      idea({ scheduledFor: "2999-07-20" }),
      idea({ id: "other", title: "Dinner", category: "food-drink" }),
    ];
    const filters = {
      ...emptyAdvancedIdeaFilters,
      statuses: ["Tentative" as const],
      scheduling: ["Upcoming" as const],
    };

    expect(filterIdeas(ideas, "culture", "exhibition", filters)).toEqual([
      ideas[0],
    ]);
  });

  it("keeps promotion cover selection stable without writing preset IDs as image URLs", () => {
    expect(pagesSource).toContain("coverStoragePath: idea?.coverStoragePath");
    expect(pagesSource).toContain("resolveIdeaCoverPreset(idea).path");
    expect(pagesSource).not.toContain("coverImage: planning.coverPresetId");
  });
});
