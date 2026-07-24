import { describe, expect, it } from "vitest";
import {
  duplicateIdeaForEditing,
  emptyAdvancedIdeaFilters,
  filterIdeas,
  normalizeCategory,
  primaryCategories,
} from "./idea-model";
import type { Idea } from "./types";

const source: Idea = {
  id: "idea-1",
  title: "Tennis lesson",
  description: "Try the evening class",
  category: "social",
  status: "Confirmed",
  tags: ["date-night"],
  addedBy: "Jordan",
  addedByUserId: "user-1",
  isDateNight: true,
  scheduledFor: "2026-08-01",
  createdAt: "2026-07-15T12:00:00Z",
  updatedAt: "2026-07-16T12:00:00Z",
  optionalLink: "https://example.com/class",
  optionalImage: "https://example.com/cover.jpg",
  coverPresetId: "social-community",
  optionalLocation: "Community centre",
  linkedAdventureId: "adventure-1",
};

describe("Idea categories", () => {
  it("keeps stable Culture data while exposing the requested labels and order", () => {
    expect(normalizeCategory("Culture")).toBe("culture");
    expect(normalizeCategory("Culture & Amusement")).toBe("culture");
    expect(primaryCategories.map(({ id, label }) => [id, label])).toEqual([
      ["food-drink", "Food & Drink"],
      ["music-events", "Music & Events"],
      ["outdoors", "Outdoors"],
      ["culture", "Culture & Amusement"],
      ["at-home", "At Home"],
      ["trips-getaways", "Trips & Getaways"],
      ["social", "Social"],
      ["errands", "Errands"],
    ]);
  });

  it("filters Social and Errands independently", () => {
    const social = { ...source, linkedAdventureId: undefined };
    const errands = { ...social, id: "idea-2", title: "Pick up parcel", category: "errands" as const };
    expect(filterIdeas([social, errands], "social", "", emptyAdvancedIdeaFilters)).toEqual([social]);
    expect(filterIdeas([source, errands], "errands", "", emptyAdvancedIdeaFilters)).toEqual([errands]);
  });

  it("hides planned Ideas by default but exposes them through the existing Planned filter", () => {
    expect(filterIdeas([source], "all", "", emptyAdvancedIdeaFilters)).toEqual([]);
    expect(filterIdeas([source], "all", "", {
      ...emptyAdvancedIdeaFilters,
      statuses: ["Planned"],
    })).toEqual([source]);
  });

  it("combines category and OR tag filters while keeping tag-label search", () => {
    const date = { ...source, linkedAdventureId: undefined };
    const rainy = {
      ...date,
      id: "idea-2",
      title: "Indoor market",
      tags: ["rainy-day"],
      isDateNight: false,
    };
    const outdoor = {
      ...date,
      id: "idea-3",
      title: "Trail walk",
      category: "outdoors" as const,
      tags: ["seasonal"],
      isDateNight: false,
    };
    const filters = {
      ...emptyAdvancedIdeaFilters,
      selectedTagSlugs: ["date-night", "rainy-day"] as const,
    };
    expect(filterIdeas([date, rainy, outdoor], "social", "", {
      ...filters,
      selectedTagSlugs: [...filters.selectedTagSlugs],
    })).toEqual([date, rainy]);
    expect(filterIdeas([date, rainy], "all", "rainy day", emptyAdvancedIdeaFilters))
      .toEqual([rainy]);
  });
});

describe("Idea duplication draft", () => {
  it("copies reusable content and resets identity, creator, and planning state", () => {
    const duplicate = duplicateIdeaForEditing(
      source,
      [source.title],
      { id: "user-2", displayName: "Liz" },
      "2026-07-17T12:00:00Z",
    );
    expect(duplicate).toMatchObject({
      id: "",
      title: "Tennis lesson — Copy",
      description: source.description,
      optionalLink: source.optionalLink,
      optionalLocation: source.optionalLocation,
      optionalImage: source.optionalImage,
      coverPresetId: source.coverPresetId,
      category: source.category,
      tags: source.tags,
      isDateNight: true,
      status: "Idea",
      addedBy: "Liz",
      addedByUserId: "user-2",
      createdAt: "2026-07-17T12:00:00Z",
      updatedAt: undefined,
      scheduledFor: undefined,
      linkedAdventureId: undefined,
    });
    expect(duplicate.tags).not.toBe(source.tags);
    duplicate.tags.splice(0, 1);
    expect(source.tags).toEqual(["date-night"]);
    expect(source.linkedAdventureId).toBe("adventure-1");
  });

  it("uses a numbered suffix when Copy already exists", () => {
    expect(duplicateIdeaForEditing(
      { ...source, title: "Tennis lesson — Copy" },
      ["Tennis lesson", "Tennis lesson — Copy"],
    ).title).toBe("Tennis lesson — Copy 2");
  });
});
