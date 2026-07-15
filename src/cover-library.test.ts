/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CATEGORY_COVER_ASSETS,
  getCategoryCoverByVariant,
  getStableCategoryCover,
} from "./category-visuals";
import { primaryCategories } from "./idea-model";
import { IDEA_COVER_PRESETS_BY_CATEGORY } from "./idea-covers";

describe("expanded category cover library", () => {
  it("registers nine labeled local assets per canonical category", () => {
    for (const { id: category } of primaryCategories) {
      const assets = CATEGORY_COVER_ASSETS[category];
      expect(assets).toHaveLength(9);
      expect(new Set(assets.map(({ path }) => path)).size).toBe(9);
      for (const asset of assets) {
        expect(asset.label.trim()).not.toBe("");
        expect(asset.path).toMatch(/^\/category-art\/covers\/.+\.webp$/);
        expect(existsSync(join(process.cwd(), "public", asset.path.slice(1))))
          .toBe(true);
      }
      expect(new Set(
        IDEA_COVER_PRESETS_BY_CATEGORY[category].map(({ path }) => path),
      )).toEqual(new Set(assets.map(({ path }) => path)));
    }
  });

  it("keeps Adventure variants and automatic covers on the original slots", () => {
    for (const { id: category } of primaryCategories) {
      const originalPaths = CATEGORY_COVER_ASSETS[category]
        .slice(0, 3)
        .map(({ path }) => path);
      expect(getCategoryCoverByVariant(category, 1)).toBe(originalPaths[0]);
      expect(getCategoryCoverByVariant(category, 2)).toBe(originalPaths[1]);
      expect(getCategoryCoverByVariant(category, 3)).toBe(originalPaths[2]);
      for (let index = 0; index < 20; index += 1) {
        expect(originalPaths).toContain(
          getStableCategoryCover(category, `adventure-${index}`),
        );
      }
    }
  });

  it("keeps the desktop grid bounded and the mobile choices horizontal", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    expect(css).toMatch(/\.cover-variant-row\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
    expect(css).toMatch(/\.cover-variant-row\s*\{[^}]*max-height:\s*286px/s);
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.cover-variant-row\s*\{[^}]*grid-auto-flow:\s*column/s);
    expect(css).toMatch(/@media \(max-width: 600px\)[\s\S]*\.cover-variant-row\s*\{[^}]*overflow-x:\s*auto/s);
  });
});
