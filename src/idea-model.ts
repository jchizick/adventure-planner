import type { Idea, IdeaStatus } from "./types";

export const primaryCategories = [
  { id: "food-drink", label: "Food & Drink" },
  { id: "music-events", label: "Music & Events" },
  { id: "outdoors", label: "Outdoors" },
  { id: "culture", label: "Culture" },
  { id: "at-home", label: "At Home" },
  { id: "trips-getaways", label: "Trips & Getaways" },
] as const;

export type Category = (typeof primaryCategories)[number]["id"];
export type IdeaCategoryFilter = "all" | "date-night" | Category;
export type IdeaFilterStatus = IdeaStatus | "Planned";
export type SchedulingFilter = "Upcoming" | "Unscheduled" | "Past";

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
  dates: "culture",
  "date-night": "culture",
  "at-home": "at-home",
  errands: "at-home",
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
    .replace("trips-and-getaways", "trips-getaways")
    .replace("camping-and-travel", "camping-travel");

export function normalizeCategory(value: string): Category {
  return aliases[slugify(value)] ?? "culture";
}

export function isLegacyDateNightCategory(value: string) {
  return ["dates", "date-night"].includes(slugify(value));
}

export function categoryLabel(category: Category) {
  return primaryCategories.find((entry) => entry.id === category)?.label ?? "Culture";
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
    const searchable = [idea.title, idea.description, idea.optionalLocation, ...idea.tags]
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
