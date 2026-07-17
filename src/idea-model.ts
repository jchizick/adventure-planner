import type { Idea, IdeaStatus } from "./types";

export const primaryCategories = [
  { id: "food-drink", label: "Food & Drink" },
  { id: "music-events", label: "Music & Events" },
  { id: "outdoors", label: "Outdoors" },
  { id: "culture", label: "Culture & Amusement" },
  { id: "at-home", label: "At Home" },
  { id: "trips-getaways", label: "Trips & Getaways" },
  { id: "social", label: "Social" },
  { id: "errands", label: "Errands" },
] as const;

export type Category = (typeof primaryCategories)[number]["id"];
export type IdeaCategoryFilter = "all" | "date-night" | Category;
export type IdeaFilterStatus = IdeaStatus | "Planned";
export type SchedulingFilter = "Upcoming" | "Unscheduled" | "Past";

const canonicalCategoryIds = new Set<string>(
  primaryCategories.map((category) => category.id),
);

export type AdvancedIdeaFilters = {
  statuses: IdeaFilterStatus[];
  addedByUserIds: string[];
  scheduling: SchedulingFilter[];
  dateNightOnly: boolean;
};

export const emptyAdvancedIdeaFilters: AdvancedIdeaFilters = {
  statuses: [],
  addedByUserIds: [],
  scheduling: [],
  dateNightOnly: false,
};

const aliases: Record<string, Category> = {
  "food-drink": "food-drink",
  food: "food-drink",
  drinks: "food-drink",
  "music-events": "music-events",
  concerts: "music-events",
  concert: "music-events",
  festivals: "music-events",
  outdoors: "outdoors",
  culture: "culture",
  "culture-amusement": "culture",
  dates: "culture",
  "date-night": "culture",
  "at-home": "at-home",
  social: "social",
  errands: "errands",
  "trips-getaways": "trips-getaways",
  "camping-travel": "trips-getaways",
  travel: "trips-getaways",
  trips: "trips-getaways",
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace("food-and-drink", "food-drink")
    .replace("music-and-events", "music-events")
    .replace("culture-and-amusement", "culture-amusement")
    .replace("trips-and-getaways", "trips-getaways")
    .replace("camping-and-travel", "camping-travel");

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && canonicalCategoryIds.has(value);
}

export function normalizeCategoryOrNull(
  value: string | null | undefined,
): Category | null {
  if (!value) return null;
  return aliases[slugify(value)] ?? null;
}

export function normalizeCategory(value: string): Category {
  return normalizeCategoryOrNull(value) ?? "culture";
}

export function isLegacyDateNightCategory(value: string) {
  return ["dates", "date-night"].includes(slugify(value));
}

export function categoryLabel(category: Category) {
  return primaryCategories.find((entry) => entry.id === category)?.label ?? "Culture & Amusement";
}

export function duplicateIdeaTitle(title: string, existingTitles: readonly string[] = []) {
  const trimmed = title.trim();
  const base = trimmed.replace(/\s+—\s+Copy(?:\s+\d+)?$/i, "") || "Untitled idea";
  const used = new Set(existingTitles.map((value) => value.trim().toLocaleLowerCase()));
  let candidate = `${base} — Copy`;
  let copyNumber = 2;
  while (used.has(candidate.toLocaleLowerCase())) {
    candidate = `${base} — Copy ${copyNumber}`;
    copyNumber += 1;
  }
  return candidate;
}

export function duplicateIdeaForEditing(
  source: Idea,
  existingTitles: readonly string[],
  creator?: { id: string; displayName: string },
  now = new Date().toISOString(),
): Idea {
  return {
    ...source,
    id: "",
    title: duplicateIdeaTitle(source.title, existingTitles),
    status: "Idea",
    addedBy: creator?.displayName ?? source.addedBy,
    addedByUserId: creator?.id,
    createdAt: now,
    updatedAt: undefined,
    scheduledFor: undefined,
    proposedStartDate: undefined,
    proposedStartTime: undefined,
    proposedEndDate: undefined,
    proposedEndTime: undefined,
    linkedAdventureId: undefined,
  };
}

export function effectiveIdeaStatus(idea: Idea): IdeaFilterStatus {
  return idea.linkedAdventureId ? "Planned" : idea.status;
}

export function ideaScheduling(
  idea: Idea,
  today = new Date().toISOString().slice(0, 10),
): SchedulingFilter {
  if (!idea.scheduledFor) return "Unscheduled";
  return idea.scheduledFor < today ? "Past" : "Upcoming";
}

export function countAdvancedIdeaFilters(filters: AdvancedIdeaFilters) {
  return filters.statuses.length + filters.addedByUserIds.length +
    filters.scheduling.length + Number(filters.dateNightOnly);
}

export function filterIdeas(
  ideas: Idea[],
  categoryFilter: IdeaCategoryFilter,
  query: string,
  advanced: AdvancedIdeaFilters,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return ideas.filter((idea) => {
    const matchesCategory = categoryFilter === "all" ||
      (categoryFilter === "date-night" ? idea.isDateNight : idea.category === categoryFilter);
    const searchable = [idea.title, idea.description, idea.optionalLink, idea.optionalLocation, ...idea.tags]
      .filter(Boolean).join(" ").toLocaleLowerCase();
    return matchesCategory &&
      (!normalizedQuery || searchable.includes(normalizedQuery)) &&
      (!advanced.statuses.length || advanced.statuses.includes(effectiveIdeaStatus(idea))) &&
      (!advanced.addedByUserIds.length ||
        (idea.addedByUserId != null && advanced.addedByUserIds.includes(idea.addedByUserId))) &&
      (!advanced.scheduling.length || advanced.scheduling.includes(ideaScheduling(idea))) &&
      (!advanced.dateNightOnly || idea.isDateNight);
  });
}
