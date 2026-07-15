/// <reference types="node" />

import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { primaryCategories } from "./idea-model";
import {
  IDEA_COVER_PRESETS,
  IDEA_COVER_PRESETS_BY_CATEGORY,
  resolveIdeaCoverPreset,
} from "./idea-covers";

describe("Idea cover preset registry", () => {
  it("has unique IDs, a general fallback, and presets for every category", () => {
    const ids = IDEA_COVER_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("general-default");
    for (const category of primaryCategories) {
      expect(
        IDEA_COVER_PRESETS_BY_CATEGORY[category.id].length,
      ).toBeGreaterThan(0);
    }
  });

  it("references existing local assets only", () => {
    for (const preset of IDEA_COVER_PRESETS) {
      expect(preset.path.startsWith("/category-art/")).toBe(true);
      expect(preset.path).not.toMatch(/^https?:/);
      expect(
        existsSync(join(process.cwd(), "public", preset.path.slice(1))),
        `${preset.id} should reference an existing asset`,
      ).toBe(true);
    }
  });
});

describe("Idea cover assignment", () => {
  it("returns the same deterministic cover for the same Idea", () => {
    const input = {
      id: "stable-idea",
      category: "outdoors" as const,
      title: "A day outside",
      description: "",
    };
    expect(resolveIdeaCoverPreset(input)).toEqual(
      resolveIdeaCoverPreset(input),
    );
  });

  it.each([
    ["food-drink", "Dinner at a new restaurant", "food-dinner"],
    ["food-drink", "Coffee and pastry", "food-cafe"],
    ["music-events", "Outdoor concert", "music-outdoor-stage"],
    ["outdoors", "Hiking through the park", "outdoors-forest-trail"],
    ["outdoors", "Paddle to the island", "outdoors-canoe-lake"],
    ["culture", "Museum gallery exhibition", "culture-gallery"],
    ["at-home", "Journal and organizing night", "home-journal"],
    ["at-home", "Bake a new recipe", "home-cooking"],
    ["trips-getaways", "Weekend at a lake cabin", "trip-lake-cabin"],
  ] as const)("maps %s keywords to %s", (category, title, expected) => {
    expect(resolveIdeaCoverPreset({ id: "idea", category, title }).id).toBe(
      expected,
    );
  });

  it("lets a recognized persisted preset win over category and keywords", () => {
    expect(
      resolveIdeaCoverPreset({
        id: "idea",
        category: "food-drink",
        title: "Restaurant dinner",
        coverPresetId: "home-journal",
      }).id,
    ).toBe("home-journal");
  });

  it("handles invalid presets and unknown categories safely", () => {
    const withoutPersisted = resolveIdeaCoverPreset({
      id: "idea",
      category: "culture",
      title: "An afternoon out",
    });
    expect(
      resolveIdeaCoverPreset({
        id: "idea",
        category: "culture",
        title: "An afternoon out",
        coverPresetId: "retired-cover",
      }),
    ).toEqual(withoutPersisted);
    expect(
      resolveIdeaCoverPreset({
        id: "legacy",
        category: "unknown-category",
        title: "Museum afternoon",
      }).id,
    ).toBe("culture-gallery");
    expect(
      resolveIdeaCoverPreset({
        id: "legacy",
        category: "unknown-category",
        title: "Something lovely",
      }).id,
    ).toBe("general-default");
  });
});
