import { adventureEffectiveEndDate } from "./calendar";
import {
  isCategory,
  type Category,
} from "./idea-model";
import {
  normalizeTagSlugs,
  type TagSlug,
} from "./tag-model";
import type {
  Adventure,
  AdventureRatingSummary,
  MemorySummary,
} from "./types";

export const memorySortOptions = [
  { value: "most-recent", label: "Most recent" },
  { value: "oldest", label: "Oldest" },
  { value: "highest-rated", label: "Highest rated" },
  { value: "most-rated", label: "Most rated" },
] as const;

export type MemorySort = (typeof memorySortOptions)[number]["value"];
export type MemoryRatingFilter = "all" | "would-do-again" | "rated" | "unrated";

export type MemoryFilters = {
  rating: MemoryRatingFilter;
  tags: TagSlug[];
  category: Category | null;
};

export type MemoryViewState = {
  sort: MemorySort;
  filters: MemoryFilters;
};

export type MemoryRatingMetrics = {
  averageRating: number | null;
  ratingCount: number;
  wouldDoAgainYes: number;
  wouldDoAgainNo: number;
  wouldDoAgainAnswered: number;
  allAnsweredWouldDoAgain: boolean;
  sharedFavouriteEligible: boolean;
};

export const defaultMemoryViewState: MemoryViewState = {
  sort: "most-recent",
  filters: {
    rating: "all",
    tags: [],
    category: null,
  },
};

const emptyRatingSummary: AdventureRatingSummary = {
  average: null,
  count: 0,
  wouldDoAgainYes: 0,
  wouldDoAgainNo: 0,
  wouldDoAgainUnanswered: 0,
};

export function getMemoryRatingMetrics(
  summary?: Pick<MemorySummary, "rating">,
): MemoryRatingMetrics {
  const rating = summary?.rating ?? emptyRatingSummary;
  const wouldDoAgainAnswered =
    rating.wouldDoAgainYes + rating.wouldDoAgainNo;
  const allAnsweredWouldDoAgain =
    wouldDoAgainAnswered > 0 &&
    rating.wouldDoAgainNo === 0 &&
    rating.wouldDoAgainUnanswered === 0;

  // A shared favourite needs a strong average, an explicit Yes, and no explicit No.
  // Unanswered Would Do Again responses are neutral rather than implicit approval.
  const sharedFavouriteEligible =
    rating.count > 0 &&
    rating.average !== null &&
    rating.average >= 4 &&
    rating.wouldDoAgainYes > 0 &&
    rating.wouldDoAgainNo === 0;

  return {
    averageRating: rating.average,
    ratingCount: rating.count,
    wouldDoAgainYes: rating.wouldDoAgainYes,
    wouldDoAgainNo: rating.wouldDoAgainNo,
    wouldDoAgainAnswered,
    allAnsweredWouldDoAgain,
    sharedFavouriteEligible,
  };
}

export function qualifiesForWouldDoAgain(
  summary?: Pick<MemorySummary, "rating">,
) {
  const metrics = getMemoryRatingMetrics(summary);
  return metrics.wouldDoAgainYes > 0 && metrics.wouldDoAgainNo === 0;
}

export function memoryChronologyKey(adventure: Adventure) {
  return adventure.completedAt || adventureEffectiveEndDate(adventure);
}

function compareText(first: string, second: string) {
  return first.localeCompare(second);
}

function compareNewest(first: Adventure, second: Adventure) {
  return compareText(
    memoryChronologyKey(second),
    memoryChronologyKey(first),
  );
}

function compareOldest(first: Adventure, second: Adventure) {
  return compareText(
    memoryChronologyKey(first),
    memoryChronologyKey(second),
  );
}

function compareAverageDescending(
  first: MemoryRatingMetrics,
  second: MemoryRatingMetrics,
) {
  if (first.averageRating === null && second.averageRating === null) return 0;
  if (first.averageRating === null) return 1;
  if (second.averageRating === null) return -1;
  return second.averageRating - first.averageRating;
}

function compareStableAdventure(first: Adventure, second: Adventure) {
  return compareText(first.id, second.id) ||
    compareText(first.title, second.title);
}

export function sortMemories(
  adventures: readonly Adventure[],
  summaries: Readonly<Record<string, MemorySummary>>,
  sort: MemorySort,
) {
  return [...adventures].sort((first, second) => {
    const firstMetrics = getMemoryRatingMetrics(summaries[first.id]);
    const secondMetrics = getMemoryRatingMetrics(summaries[second.id]);

    if (sort === "oldest")
      return compareOldest(first, second) ||
        compareStableAdventure(first, second);

    if (sort === "highest-rated")
      return compareAverageDescending(firstMetrics, secondMetrics) ||
        secondMetrics.ratingCount - firstMetrics.ratingCount ||
        compareNewest(first, second) ||
        compareStableAdventure(first, second);

    if (sort === "most-rated")
      return secondMetrics.ratingCount - firstMetrics.ratingCount ||
        compareAverageDescending(firstMetrics, secondMetrics) ||
        compareNewest(first, second) ||
        compareStableAdventure(first, second);

    return compareNewest(first, second) ||
      compareStableAdventure(first, second);
  });
}

export function filterMemories(
  adventures: readonly Adventure[],
  summaries: Readonly<Record<string, MemorySummary>>,
  filters: MemoryFilters,
) {
  return adventures.filter((adventure) => {
    const metrics = getMemoryRatingMetrics(summaries[adventure.id]);
    const normalizedTags = normalizeTagSlugs(adventure.tags);
    const matchesRating =
      filters.rating === "all" ||
      (filters.rating === "rated" && metrics.ratingCount > 0) ||
      (filters.rating === "unrated" && metrics.ratingCount === 0) ||
      (filters.rating === "would-do-again" &&
        qualifiesForWouldDoAgain(summaries[adventure.id]));
    const matchesTags =
      !filters.tags.length ||
      filters.tags.some((tag) => normalizedTags.includes(tag));
    const matchesCategory =
      filters.category === null ||
      adventure.category === filters.category;

    return matchesRating && matchesTags && matchesCategory;
  });
}

export function filterAndSortMemories(
  adventures: readonly Adventure[],
  summaries: Readonly<Record<string, MemorySummary>>,
  view: MemoryViewState,
) {
  return sortMemories(
    filterMemories(adventures, summaries, view.filters),
    summaries,
    view.sort,
  );
}

export function selectOurFavourites(
  adventures: readonly Adventure[],
  summaries: Readonly<Record<string, MemorySummary>>,
) {
  return [...adventures]
    .filter((adventure) =>
      getMemoryRatingMetrics(summaries[adventure.id]).sharedFavouriteEligible)
    .sort((first, second) => {
      const firstMetrics = getMemoryRatingMetrics(summaries[first.id]);
      const secondMetrics = getMemoryRatingMetrics(summaries[second.id]);
      return compareAverageDescending(firstMetrics, secondMetrics) ||
        secondMetrics.ratingCount - firstMetrics.ratingCount ||
        secondMetrics.wouldDoAgainYes - firstMetrics.wouldDoAgainYes ||
        compareNewest(first, second) ||
        compareStableAdventure(first, second);
    });
}

export function countMemoryFilters(filters: MemoryFilters) {
  return (filters.rating === "all" ? 0 : 1) +
    filters.tags.length +
    (filters.category ? 1 : 0);
}

function isMemorySort(value: string | null): value is MemorySort {
  return memorySortOptions.some((option) => option.value === value);
}

function isMemoryRatingFilter(
  value: string | null,
): value is MemoryRatingFilter {
  return value === "all" ||
    value === "would-do-again" ||
    value === "rated" ||
    value === "unrated";
}

export function parseMemoryViewParams(
  params: URLSearchParams,
): MemoryViewState {
  const sortParam = params.get("sort");
  const ratingParam = params.get("rating");
  const categoryParam = params.get("category");
  return {
    sort: isMemorySort(sortParam) ? sortParam : "most-recent",
    filters: {
      rating: isMemoryRatingFilter(ratingParam) ? ratingParam : "all",
      tags: normalizeTagSlugs(params.get("tags")?.split(",") ?? []),
      category: isCategory(categoryParam) ? categoryParam : null,
    },
  };
}

export function serializeMemoryViewParams(
  view: MemoryViewState,
  current?: URLSearchParams,
) {
  const params = new URLSearchParams(current);
  if (view.sort === "most-recent") params.delete("sort");
  else params.set("sort", view.sort);
  if (view.filters.rating === "all") params.delete("rating");
  else params.set("rating", view.filters.rating);
  if (view.filters.tags.length)
    params.set("tags", normalizeTagSlugs(view.filters.tags).join(","));
  else params.delete("tags");
  if (view.filters.category) params.set("category", view.filters.category);
  else params.delete("category");
  return params;
}
