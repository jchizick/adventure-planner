import { normalizeCategoryOrNull, type Category } from "./idea-model";
import type {
  Adventure,
  MemoryPhoto,
} from "./types";

export const GENERIC_IDEA_ART = "/category-art/generic/idea.webp";
export const GENERIC_ADVENTURE_COVER =
  "/category-art/generic/adventure-cover.webp";

export const CATEGORY_IDEA_ART: Record<Category, string> = {
  "food-drink": "/category-art/ideas/food-drink.webp",
  "music-events": "/category-art/ideas/music-events.webp",
  outdoors: "/category-art/ideas/outdoors.webp",
  culture: "/category-art/ideas/culture.webp",
  "at-home": "/category-art/ideas/at-home.webp",
  "trips-getaways": "/category-art/ideas/trips-getaways.webp",
};

export type CategoryCoverAsset = {
  path: string;
  label: string;
};

export const CATEGORY_COVER_ASSETS: Record<
  Category,
  readonly CategoryCoverAsset[]
> = {
  "food-drink": [
    { path: "/category-art/covers/food-drink/01.webp", label: "Sunny brunch" },
    { path: "/category-art/covers/food-drink/02.webp", label: "Romantic dinner" },
    { path: "/category-art/covers/food-drink/03.webp", label: "Quiet cafe" },
    { path: "/category-art/covers/food-drink/04.webp", label: "Waterfront food market" },
    { path: "/category-art/covers/food-drink/05.webp", label: "Sushi bar" },
    { path: "/category-art/covers/food-drink/06.webp", label: "Vineyard picnic" },
    { path: "/category-art/covers/food-drink/07.webp", label: "Candlelit dinner" },
    { path: "/category-art/covers/food-drink/08.webp", label: "Window cafe" },
    { path: "/category-art/covers/food-drink/09.webp", label: "Garden dinner" },
  ],
  "music-events": [
    { path: "/category-art/covers/music-events/01.webp", label: "Outdoor concert" },
    { path: "/category-art/covers/music-events/02.webp", label: "Dance night" },
    { path: "/category-art/covers/music-events/03.webp", label: "Acoustic cafe" },
    { path: "/category-art/covers/music-events/04.webp", label: "Classical concert hall" },
    { path: "/category-art/covers/music-events/05.webp", label: "Day festival" },
    { path: "/category-art/covers/music-events/06.webp", label: "Neon concert" },
    { path: "/category-art/covers/music-events/07.webp", label: "Community concert" },
    { path: "/category-art/covers/music-events/08.webp", label: "Theatre stage" },
    { path: "/category-art/covers/music-events/09.webp", label: "Jazz club" },
  ],
  outdoors: [
    { path: "/category-art/covers/outdoors/01.webp", label: "Forest trail" },
    { path: "/category-art/covers/outdoors/02.webp", label: "Canoe on the lake" },
    { path: "/category-art/covers/outdoors/03.webp", label: "Coastal walk" },
    { path: "/category-art/covers/outdoors/04.webp", label: "Lakeside campsite" },
    { path: "/category-art/covers/outdoors/05.webp", label: "Mountain meadow picnic" },
    { path: "/category-art/covers/outdoors/06.webp", label: "Mountain trail" },
    { path: "/category-art/covers/outdoors/07.webp", label: "Waterfall boardwalk" },
    { path: "/category-art/covers/outdoors/08.webp", label: "Coastal hike" },
    { path: "/category-art/covers/outdoors/09.webp", label: "Canoe sunrise" },
  ],
  culture: [
    { path: "/category-art/covers/culture/01.webp", label: "Historic estate" },
    { path: "/category-art/covers/culture/02.webp", label: "Sculpture garden" },
    { path: "/category-art/covers/culture/03.webp", label: "Gallery visit" },
    { path: "/category-art/covers/culture/04.webp", label: "Historic library" },
    { path: "/category-art/covers/culture/05.webp", label: "Classical courtyard" },
    { path: "/category-art/covers/culture/06.webp", label: "Pottery studio" },
    { path: "/category-art/covers/culture/07.webp", label: "Coastal sculpture garden" },
    { path: "/category-art/covers/culture/08.webp", label: "Modern gallery" },
    { path: "/category-art/covers/culture/09.webp", label: "Arts district" },
  ],
  "at-home": [
    { path: "/category-art/covers/at-home/01.webp", label: "Cozy night in" },
    { path: "/category-art/covers/at-home/02.webp", label: "Journal and crafts" },
    { path: "/category-art/covers/at-home/03.webp", label: "Cooking at home" },
    { path: "/category-art/covers/at-home/04.webp", label: "Yoga and meditation" },
    { path: "/category-art/covers/at-home/05.webp", label: "Movie night" },
    { path: "/category-art/covers/at-home/06.webp", label: "Board game night" },
    { path: "/category-art/covers/at-home/07.webp", label: "Reading nook" },
    { path: "/category-art/covers/at-home/08.webp", label: "Baking at home" },
    { path: "/category-art/covers/at-home/09.webp", label: "Creative studio" },
  ],
  "trips-getaways": [
    { path: "/category-art/covers/trips-getaways/01.webp", label: "Countryside road" },
    { path: "/category-art/covers/trips-getaways/02.webp", label: "Lake cabin" },
    { path: "/category-art/covers/trips-getaways/03.webp", label: "Old town" },
    { path: "/category-art/covers/trips-getaways/04.webp", label: "Coastal road trip" },
    { path: "/category-art/covers/trips-getaways/05.webp", label: "Mediterranean harbour" },
    { path: "/category-art/covers/trips-getaways/06.webp", label: "Old-town sunset" },
    { path: "/category-art/covers/trips-getaways/07.webp", label: "Mountain lodge" },
    { path: "/category-art/covers/trips-getaways/08.webp", label: "Lakeside cabin" },
    { path: "/category-art/covers/trips-getaways/09.webp", label: "Scenic train" },
  ],
};

export const CATEGORY_COVERS: Record<Category, readonly string[]> = {
  "food-drink": CATEGORY_COVER_ASSETS["food-drink"].map(({ path }) => path),
  "music-events": CATEGORY_COVER_ASSETS["music-events"].map(({ path }) => path),
  outdoors: CATEGORY_COVER_ASSETS.outdoors.map(({ path }) => path),
  culture: CATEGORY_COVER_ASSETS.culture.map(({ path }) => path),
  "at-home": CATEGORY_COVER_ASSETS["at-home"].map(({ path }) => path),
  "trips-getaways": CATEGORY_COVER_ASSETS["trips-getaways"].map(({ path }) => path),
};

export function stableVisualHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function visualCategory(category: Category | string | null | undefined) {
  return normalizeCategoryOrNull(category);
}

export function getCategoryIllustration(
  category: Category | string | null | undefined,
) {
  const canonical = visualCategory(category);
  return canonical ? CATEGORY_IDEA_ART[canonical] : GENERIC_IDEA_ART;
}

export function getStableCategoryCover(
  category: Category | string | null | undefined,
  recordId: string,
) {
  const canonical = visualCategory(category);
  if (!canonical) return GENERIC_ADVENTURE_COVER;
  // Automatic Adventure covers intentionally remain on the original three
  // assets so expanding the picker cannot rotate an existing Adventure.
  const variants = CATEGORY_COVERS[canonical].slice(0, 3);
  if (!variants.length) return GENERIC_ADVENTURE_COVER;
  return variants[stableVisualHash(recordId) % variants.length];
}

export function getCategoryCoverByVariant(
  category: Category | string | null | undefined,
  variant: number | null | undefined,
) {
  const canonical = visualCategory(category);
  if (!canonical || variant !== 1 && variant !== 2 && variant !== 3)
    return undefined;
  return CATEGORY_COVERS[canonical][variant - 1] as
    | string
    | undefined;
}

export function resolveAdventureCover(
  adventure: Pick<
    Adventure,
    "id" | "category" | "coverImage" | "coverVariant"
  >,
) {
  return adventure.coverImage?.trim() ||
    getCategoryCoverByVariant(adventure.category, adventure.coverVariant) ||
    getStableCategoryCover(adventure.category, adventure.id);
}

export function resolveMemoryCover({
  adventure,
  featuredPhotoUrl,
  firstPhotoUrl,
  photos,
}: {
  adventure: Pick<
    Adventure,
    "id" | "category" | "coverImage" | "coverVariant"
  >;
  featuredPhotoUrl?: string | null;
  firstPhotoUrl?: string | null;
  photos?: readonly Pick<MemoryPhoto, "url">[];
}) {
  return featuredPhotoUrl?.trim() || firstPhotoUrl?.trim() ||
    photos?.[0]?.url?.trim() || resolveAdventureCover(adventure);
}
