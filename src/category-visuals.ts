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

export const CATEGORY_COVERS: Record<Category, readonly string[]> = {
  "food-drink": [
    "/category-art/covers/food-drink/01.webp",
    "/category-art/covers/food-drink/02.webp",
    "/category-art/covers/food-drink/03.webp",
  ],
  "music-events": [
    "/category-art/covers/music-events/01.webp",
    "/category-art/covers/music-events/02.webp",
    "/category-art/covers/music-events/03.webp",
  ],
  outdoors: [
    "/category-art/covers/outdoors/01.webp",
    "/category-art/covers/outdoors/02.webp",
    "/category-art/covers/outdoors/03.webp",
  ],
  culture: [
    "/category-art/covers/culture/01.webp",
    "/category-art/covers/culture/02.webp",
    "/category-art/covers/culture/03.webp",
  ],
  "at-home": [
    "/category-art/covers/at-home/01.webp",
    "/category-art/covers/at-home/02.webp",
    "/category-art/covers/at-home/03.webp",
  ],
  "trips-getaways": [
    "/category-art/covers/trips-getaways/01.webp",
    "/category-art/covers/trips-getaways/02.webp",
    "/category-art/covers/trips-getaways/03.webp",
  ],
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
  const variants = CATEGORY_COVERS[canonical];
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
