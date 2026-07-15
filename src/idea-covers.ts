import {
  CATEGORY_COVERS,
  GENERIC_ADVENTURE_COVER,
  stableVisualHash,
} from "./category-visuals";
import { normalizeCategoryOrNull, type Category } from "./idea-model";

export type IdeaCoverCategory = Category | "general";

type PresetDefinition = {
  id: string;
  category: IdeaCoverCategory;
  label: string;
  path: string;
  keywords: readonly string[];
};

export const IDEA_COVER_PRESETS = [
  {
    id: "food-dinner",
    category: "food-drink",
    label: "Candlelit dinner",
    path: CATEGORY_COVERS["food-drink"][0],
    keywords: [
      "restaurant",
      "dinner",
      "dining",
      "brunch",
      "lunch",
      "supper",
      "tasting",
    ],
  },
  {
    id: "food-cafe",
    category: "food-drink",
    label: "Coffee and pastry",
    path: CATEGORY_COVERS["food-drink"][1],
    keywords: ["coffee", "cafe", "bakery", "pastry"],
  },
  {
    id: "food-garden",
    category: "food-drink",
    label: "Garden table",
    path: CATEGORY_COVERS["food-drink"][2],
    keywords: ["picnic", "patio", "garden", "market"],
  },
  {
    id: "music-jazz-stage",
    category: "music-events",
    label: "Jazz stage",
    path: CATEGORY_COVERS["music-events"][0],
    keywords: ["jazz", "blues", "live music"],
  },
  {
    id: "music-outdoor-stage",
    category: "music-events",
    label: "Outdoor concert",
    path: CATEGORY_COVERS["music-events"][1],
    keywords: ["concert", "festival", "gig", "band"],
  },
  {
    id: "music-theatre",
    category: "music-events",
    label: "Theatre stage",
    path: CATEGORY_COVERS["music-events"][2],
    keywords: ["theatre", "theater", "musical", "opera", "orchestra", "stage"],
  },
  {
    id: "outdoors-forest-trail",
    category: "outdoors",
    label: "Forest trail",
    path: CATEGORY_COVERS.outdoors[0],
    keywords: [
      "hike",
      "hiking",
      "trail",
      "trails",
      "camping",
      "park",
      "forest",
    ],
  },
  {
    id: "outdoors-canoe-lake",
    category: "outdoors",
    label: "Canoe on the lake",
    path: CATEGORY_COVERS.outdoors[1],
    keywords: ["canoe", "kayak", "lake", "island", "paddle", "paddling"],
  },
  {
    id: "outdoors-coast",
    category: "outdoors",
    label: "Coastal walk",
    path: CATEGORY_COVERS.outdoors[2],
    keywords: ["beach", "coast", "coastal", "ocean"],
  },
  {
    id: "culture-estate",
    category: "culture",
    label: "Historic estate",
    path: CATEGORY_COVERS.culture[0],
    keywords: [
      "heritage",
      "historic",
      "history",
      "garden",
      "estate",
      "architecture",
    ],
  },
  {
    id: "culture-sculpture",
    category: "culture",
    label: "Sculpture garden",
    path: CATEGORY_COVERS.culture[1],
    keywords: ["sculpture", "installation", "statue"],
  },
  {
    id: "culture-gallery",
    category: "culture",
    label: "Gallery visit",
    path: CATEGORY_COVERS.culture[2],
    keywords: ["museum", "gallery", "exhibit", "exhibition", "art"],
  },
  {
    id: "home-cozy-night",
    category: "at-home",
    label: "Cozy night in",
    path: CATEGORY_COVERS["at-home"][0],
    keywords: ["movie", "film", "game", "reading", "cozy"],
  },
  {
    id: "home-journal",
    category: "at-home",
    label: "Journal and crafts",
    path: CATEGORY_COVERS["at-home"][1],
    keywords: [
      "journal",
      "journaling",
      "craft",
      "organize",
      "organizing",
      "scrapbook",
    ],
  },
  {
    id: "home-cooking",
    category: "at-home",
    label: "Cooking at home",
    path: CATEGORY_COVERS["at-home"][2],
    keywords: ["cook", "cooking", "bake", "baking", "recipe", "kitchen"],
  },
  {
    id: "trip-countryside",
    category: "trips-getaways",
    label: "Countryside road",
    path: CATEGORY_COVERS["trips-getaways"][0],
    keywords: ["road trip", "countryside", "scenic", "drive"],
  },
  {
    id: "trip-lake-cabin",
    category: "trips-getaways",
    label: "Lake cabin",
    path: CATEGORY_COVERS["trips-getaways"][1],
    keywords: ["cabin", "cottage", "lodge", "getaway", "lake"],
  },
  {
    id: "trip-old-town",
    category: "trips-getaways",
    label: "Old town",
    path: CATEGORY_COVERS["trips-getaways"][2],
    keywords: ["city", "town", "village", "travel", "weekend"],
  },
  {
    id: "general-default",
    category: "general",
    label: "Garden estate",
    path: GENERIC_ADVENTURE_COVER,
    keywords: [],
  },
] as const satisfies readonly PresetDefinition[];

export type IdeaCoverPreset = (typeof IDEA_COVER_PRESETS)[number];
export type IdeaCoverPresetId = IdeaCoverPreset["id"];

const presetsById = new Map<string, IdeaCoverPreset>(
  IDEA_COVER_PRESETS.map((preset) => [preset.id, preset]),
);

function presetsFor(category: Category) {
  return IDEA_COVER_PRESETS.filter((preset) => preset.category === category);
}

export const IDEA_COVER_PRESETS_BY_CATEGORY: Record<
  Category,
  readonly IdeaCoverPreset[]
> = {
  "food-drink": presetsFor("food-drink"),
  "music-events": presetsFor("music-events"),
  outdoors: presetsFor("outdoors"),
  culture: presetsFor("culture"),
  "at-home": presetsFor("at-home"),
  "trips-getaways": presetsFor("trips-getaways"),
};

export function isIdeaCoverPresetId(
  value: unknown,
): value is IdeaCoverPresetId {
  return typeof value === "string" && presetsById.has(value);
}

export function getIdeaCoverPreset(id: IdeaCoverPresetId) {
  return presetsById.get(id) as IdeaCoverPreset;
}

function normalizedWords(...values: (string | null | undefined)[]) {
  return ` ${values
    .filter(Boolean)
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

function matchesKeyword(searchable: string, keyword: string) {
  return searchable.includes(` ${keyword} `);
}

function keywordPreset(
  presets: readonly IdeaCoverPreset[],
  searchable: string,
) {
  return presets.find((preset) =>
    preset.keywords.some((keyword) => matchesKeyword(searchable, keyword)),
  );
}

export type IdeaCoverAssignment = {
  id: string;
  category: Category | string | null | undefined;
  title?: string | null;
  description?: string | null;
  isDateNight?: boolean;
  coverPresetId?: string | null;
};

export function resolveIdeaCoverPreset(
  idea: IdeaCoverAssignment,
): IdeaCoverPreset {
  if (isIdeaCoverPresetId(idea.coverPresetId)) {
    return getIdeaCoverPreset(idea.coverPresetId);
  }

  const category = normalizeCategoryOrNull(idea.category);
  const searchable = normalizedWords(idea.title, idea.description);
  if (!category) {
    return (
      keywordPreset(
        IDEA_COVER_PRESETS.filter((preset) => preset.category !== "general"),
        searchable,
      ) ?? getIdeaCoverPreset("general-default")
    );
  }

  const presets = IDEA_COVER_PRESETS_BY_CATEGORY[category];
  const matched = keywordPreset(presets, searchable);
  if (matched) return matched;
  if (idea.isDateNight && category === "food-drink") {
    return getIdeaCoverPreset("food-dinner");
  }
  if (idea.isDateNight && category === "at-home") {
    return getIdeaCoverPreset("home-cozy-night");
  }

  const stableKey = idea.id.trim() || searchable.trim() || category;
  return presets[stableVisualHash(stableKey) % presets.length];
}
