import {
  CATEGORY_COVER_ASSETS,
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
    label: "Romantic dinner",
    path: CATEGORY_COVERS["food-drink"][1],
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
    label: "Quiet cafe",
    path: CATEGORY_COVERS["food-drink"][2],
    keywords: ["coffee", "cafe", "bakery", "pastry"],
  },
  {
    id: "food-garden",
    category: "food-drink",
    label: "Garden dinner",
    path: CATEGORY_COVERS["food-drink"][8],
    keywords: ["picnic", "patio", "garden", "market"],
  },
  {
    id: "music-jazz-stage",
    category: "music-events",
    label: "Jazz club",
    path: CATEGORY_COVERS["music-events"][8],
    keywords: ["jazz", "blues", "live music"],
  },
  {
    id: "music-outdoor-stage",
    category: "music-events",
    label: "Outdoor concert",
    path: CATEGORY_COVERS["music-events"][0],
    keywords: ["concert", "festival", "gig", "band"],
  },
  {
    id: "music-theatre",
    category: "music-events",
    label: "Theatre stage",
    path: CATEGORY_COVERS["music-events"][7],
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
    id: "food-sunny-brunch",
    category: "food-drink",
    label: "Sunny brunch",
    path: CATEGORY_COVERS["food-drink"][0],
    keywords: ["brunch", "breakfast"],
  },
  {
    id: "food-waterfront-market",
    category: "food-drink",
    label: "Waterfront food market",
    path: CATEGORY_COVERS["food-drink"][3],
    keywords: ["food market", "waterfront market"],
  },
  {
    id: "food-sushi-bar",
    category: "food-drink",
    label: "Sushi bar",
    path: CATEGORY_COVERS["food-drink"][4],
    keywords: ["sushi", "omakase"],
  },
  {
    id: "food-vineyard-picnic",
    category: "food-drink",
    label: "Vineyard picnic",
    path: CATEGORY_COVERS["food-drink"][5],
    keywords: ["vineyard", "winery", "wine tasting"],
  },
  {
    id: "food-candlelit-dinner",
    category: "food-drink",
    label: "Candlelit dinner",
    path: CATEGORY_COVERS["food-drink"][6],
    keywords: ["candlelit", "date dinner"],
  },
  {
    id: "food-window-cafe",
    category: "food-drink",
    label: "Window cafe",
    path: CATEGORY_COVERS["food-drink"][7],
    keywords: ["quiet cafe", "window cafe"],
  },
  {
    id: "music-dance-night",
    category: "music-events",
    label: "Dance night",
    path: CATEGORY_COVERS["music-events"][1],
    keywords: ["dance", "dancing", "club", "disco"],
  },
  {
    id: "music-acoustic-cafe",
    category: "music-events",
    label: "Acoustic cafe",
    path: CATEGORY_COVERS["music-events"][2],
    keywords: ["acoustic", "singer songwriter"],
  },
  {
    id: "music-classical-hall",
    category: "music-events",
    label: "Classical concert hall",
    path: CATEGORY_COVERS["music-events"][3],
    keywords: ["classical", "symphony", "chamber music"],
  },
  {
    id: "music-day-festival",
    category: "music-events",
    label: "Day festival",
    path: CATEGORY_COVERS["music-events"][4],
    keywords: ["day festival", "music festival"],
  },
  {
    id: "music-neon-concert",
    category: "music-events",
    label: "Neon concert",
    path: CATEGORY_COVERS["music-events"][5],
    keywords: ["arena", "neon concert"],
  },
  {
    id: "music-community-concert",
    category: "music-events",
    label: "Community concert",
    path: CATEGORY_COVERS["music-events"][6],
    keywords: ["community concert", "park concert"],
  },
  {
    id: "outdoors-lakeside-campsite",
    category: "outdoors",
    label: "Lakeside campsite",
    path: CATEGORY_COVERS.outdoors[3],
    keywords: ["campsite", "campfire", "tent"],
  },
  {
    id: "outdoors-meadow-picnic",
    category: "outdoors",
    label: "Mountain meadow picnic",
    path: CATEGORY_COVERS.outdoors[4],
    keywords: ["meadow picnic", "mountain picnic"],
  },
  {
    id: "outdoors-mountain-trail",
    category: "outdoors",
    label: "Mountain trail",
    path: CATEGORY_COVERS.outdoors[5],
    keywords: ["mountain trail", "mountain hike"],
  },
  {
    id: "outdoors-waterfall-boardwalk",
    category: "outdoors",
    label: "Waterfall boardwalk",
    path: CATEGORY_COVERS.outdoors[6],
    keywords: ["waterfall", "boardwalk"],
  },
  {
    id: "outdoors-coastal-hike",
    category: "outdoors",
    label: "Coastal hike",
    path: CATEGORY_COVERS.outdoors[7],
    keywords: ["coastal hike", "clifftop"],
  },
  {
    id: "outdoors-canoe-sunrise",
    category: "outdoors",
    label: "Canoe sunrise",
    path: CATEGORY_COVERS.outdoors[8],
    keywords: ["canoe sunrise", "sunrise paddle"],
  },
  {
    id: "culture-historic-library",
    category: "culture",
    label: "Historic library",
    path: CATEGORY_COVERS.culture[3],
    keywords: ["library", "reading room", "books"],
  },
  {
    id: "culture-classical-courtyard",
    category: "culture",
    label: "Classical courtyard",
    path: CATEGORY_COVERS.culture[4],
    keywords: ["courtyard", "classical architecture"],
  },
  {
    id: "culture-pottery-studio",
    category: "culture",
    label: "Pottery studio",
    path: CATEGORY_COVERS.culture[5],
    keywords: ["pottery", "ceramics", "clay"],
  },
  {
    id: "culture-coastal-sculpture-garden",
    category: "culture",
    label: "Coastal sculpture garden",
    path: CATEGORY_COVERS.culture[6],
    keywords: ["coastal sculpture", "waterfront sculpture"],
  },
  {
    id: "culture-modern-gallery",
    category: "culture",
    label: "Modern gallery",
    path: CATEGORY_COVERS.culture[7],
    keywords: ["modern gallery", "contemporary art"],
  },
  {
    id: "culture-arts-district",
    category: "culture",
    label: "Arts district",
    path: CATEGORY_COVERS.culture[8],
    keywords: ["arts district", "gallery district"],
  },
  {
    id: "home-yoga-meditation",
    category: "at-home",
    label: "Yoga and meditation",
    path: CATEGORY_COVERS["at-home"][3],
    keywords: ["yoga", "meditation", "mindfulness"],
  },
  {
    id: "home-movie-night",
    category: "at-home",
    label: "Movie night",
    path: CATEGORY_COVERS["at-home"][4],
    keywords: ["movie night", "film night"],
  },
  {
    id: "home-board-games",
    category: "at-home",
    label: "Board game night",
    path: CATEGORY_COVERS["at-home"][5],
    keywords: ["board game", "cards night"],
  },
  {
    id: "home-reading-nook",
    category: "at-home",
    label: "Reading nook",
    path: CATEGORY_COVERS["at-home"][6],
    keywords: ["reading nook", "book night"],
  },
  {
    id: "home-baking",
    category: "at-home",
    label: "Baking at home",
    path: CATEGORY_COVERS["at-home"][7],
    keywords: ["baking", "cookies", "cake"],
  },
  {
    id: "home-creative-studio",
    category: "at-home",
    label: "Creative studio",
    path: CATEGORY_COVERS["at-home"][8],
    keywords: ["creative studio", "painting", "watercolor"],
  },
  {
    id: "trip-coastal-road-trip",
    category: "trips-getaways",
    label: "Coastal road trip",
    path: CATEGORY_COVERS["trips-getaways"][3],
    keywords: ["coastal drive", "coastal road trip", "mini cooper"],
  },
  {
    id: "trip-mediterranean-harbour",
    category: "trips-getaways",
    label: "Mediterranean harbour",
    path: CATEGORY_COVERS["trips-getaways"][4],
    keywords: ["mediterranean", "harbour", "harbor"],
  },
  {
    id: "trip-old-town-sunset",
    category: "trips-getaways",
    label: "Old-town sunset",
    path: CATEGORY_COVERS["trips-getaways"][5],
    keywords: ["old town sunset", "sunset town"],
  },
  {
    id: "trip-mountain-lodge",
    category: "trips-getaways",
    label: "Mountain lodge",
    path: CATEGORY_COVERS["trips-getaways"][6],
    keywords: ["mountain lodge", "mountain retreat"],
  },
  {
    id: "trip-lakeside-cabin",
    category: "trips-getaways",
    label: "Lakeside cabin",
    path: CATEGORY_COVERS["trips-getaways"][7],
    keywords: ["lakeside cabin", "lakeside cottage"],
  },
  {
    id: "trip-scenic-train",
    category: "trips-getaways",
    label: "Scenic train",
    path: CATEGORY_COVERS["trips-getaways"][8],
    keywords: ["scenic train", "rail journey", "train trip"],
  },
  {
    id: "social-community",
    category: "social",
    label: "Outdoor gathering",
    path: CATEGORY_COVERS.social[0],
    keywords: ["friends", "party", "community", "gathering"],
  },
  {
    id: "social-games",
    category: "social",
    label: "Dance with friends",
    path: CATEGORY_COVERS.social[1],
    keywords: ["games", "game night", "group"],
  },
  {
    id: "social-market",
    category: "social",
    label: "Cafe meetup",
    path: CATEGORY_COVERS.social[2],
    keywords: ["meet", "market", "hangout"],
  },
  {
    id: "errands-list",
    category: "errands",
    label: "Home supplies",
    path: CATEGORY_COVERS.errands[0],
    keywords: ["list", "organize", "appointment"],
  },
  {
    id: "errands-market",
    category: "errands",
    label: "Plan the list",
    path: CATEGORY_COVERS.errands[1],
    keywords: ["groceries", "shopping", "market"],
  },
  {
    id: "errands-town",
    category: "errands",
    label: "Grocery prep",
    path: CATEGORY_COVERS.errands[2],
    keywords: ["pickup", "drop off", "around town"],
  },
  ...([3, 4, 5, 6, 7, 8] as const).map((index) => ({
    id: `social-option-${index + 1}`,
    category: "social" as const,
    label: CATEGORY_COVER_ASSETS.social[index].label,
    path: CATEGORY_COVERS.social[index],
    keywords: [] as const,
  })),
  ...([3, 4, 5, 6, 7, 8] as const).map((index) => ({
    id: `errands-option-${index + 1}`,
    category: "errands" as const,
    label: CATEGORY_COVER_ASSETS.errands[index].label,
    path: CATEGORY_COVERS.errands[index],
    keywords: [] as const,
  })),
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
  social: presetsFor("social"),
  errands: presetsFor("errands"),
};

const LEGACY_PRESET_IDS_BY_CATEGORY: Record<Category, readonly IdeaCoverPresetId[]> = {
  "food-drink": ["food-dinner", "food-cafe", "food-garden"],
  "music-events": ["music-jazz-stage", "music-outdoor-stage", "music-theatre"],
  outdoors: ["outdoors-forest-trail", "outdoors-canoe-lake", "outdoors-coast"],
  culture: ["culture-estate", "culture-sculpture", "culture-gallery"],
  "at-home": ["home-cozy-night", "home-journal", "home-cooking"],
  "trips-getaways": ["trip-countryside", "trip-lake-cabin", "trip-old-town"],
  social: ["social-community", "social-games", "social-market"],
  errands: ["errands-list", "errands-market", "errands-town"],
};

const LEGACY_PRESETS_BY_CATEGORY: Record<Category, readonly IdeaCoverPreset[]> = {
  "food-drink": LEGACY_PRESET_IDS_BY_CATEGORY["food-drink"].map(getIdeaCoverPreset),
  "music-events": LEGACY_PRESET_IDS_BY_CATEGORY["music-events"].map(getIdeaCoverPreset),
  outdoors: LEGACY_PRESET_IDS_BY_CATEGORY.outdoors.map(getIdeaCoverPreset),
  culture: LEGACY_PRESET_IDS_BY_CATEGORY.culture.map(getIdeaCoverPreset),
  "at-home": LEGACY_PRESET_IDS_BY_CATEGORY["at-home"].map(getIdeaCoverPreset),
  "trips-getaways": LEGACY_PRESET_IDS_BY_CATEGORY["trips-getaways"].map(getIdeaCoverPreset),
  social: LEGACY_PRESET_IDS_BY_CATEGORY.social.map(getIdeaCoverPreset),
  errands: LEGACY_PRESET_IDS_BY_CATEGORY.errands.map(getIdeaCoverPreset),
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
  tags?: readonly string[];
  coverPresetId?: string | null;
};

function resolveAutomaticIdeaCoverPreset(
  idea: IdeaCoverAssignment,
  expanded: boolean,
): IdeaCoverPreset {
  if (isIdeaCoverPresetId(idea.coverPresetId)) {
    return getIdeaCoverPreset(idea.coverPresetId);
  }

  const category = normalizeCategoryOrNull(idea.category);
  const searchable = normalizedWords(idea.title, idea.description);
  if (!category) {
    return (
      keywordPreset(
        (expanded ? IDEA_COVER_PRESETS : Object.values(LEGACY_PRESETS_BY_CATEGORY).flat())
          .filter((preset) => preset.category !== "general"),
        searchable,
      ) ?? getIdeaCoverPreset("general-default")
    );
  }

  const presets = expanded
    ? IDEA_COVER_PRESETS_BY_CATEGORY[category]
    : LEGACY_PRESETS_BY_CATEGORY[category];
  const keywordPresets = expanded
    ? [...presets.slice(3), ...presets.slice(0, 3)]
    : presets;
  const matched = keywordPreset(keywordPresets, searchable);
  if (matched) return matched;
  const isDateNight = idea.tags?.includes("date-night") || idea.isDateNight;
  if (isDateNight && category === "food-drink") {
    return getIdeaCoverPreset("food-dinner");
  }
  if (isDateNight && category === "at-home") {
    return getIdeaCoverPreset("home-cozy-night");
  }

  const stableKey = idea.id.trim() || searchable.trim() || category;
  return presets[stableVisualHash(stableKey) % presets.length];
}

// Existing rows with no persisted preset keep the original three-item pool.
export function resolveIdeaCoverPreset(idea: IdeaCoverAssignment) {
  return resolveAutomaticIdeaCoverPreset(idea, false);
}

// Creation persists the result, so new Ideas can safely use the expanded pool.
export function resolveNewIdeaCoverPreset(idea: IdeaCoverAssignment) {
  return resolveAutomaticIdeaCoverPreset(idea, true);
}
