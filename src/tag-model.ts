export const curatedTags = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "date-night",
    label: "Date Night",
    iconKey: "heart",
    sortOrder: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    slug: "friends-family",
    label: "With Friends & Family",
    iconKey: "users",
    sortOrder: 2,
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    slug: "archie-friendly",
    label: "Archie-Friendly",
    iconKey: "paw-print",
    sortOrder: 3,
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    slug: "seasonal",
    label: "Seasonal",
    iconKey: "leaf",
    sortOrder: 4,
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    slug: "rainy-day",
    label: "Rainy Day",
    iconKey: "cloud-rain",
    sortOrder: 5,
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    slug: "recurring",
    label: "Recurring",
    iconKey: "repeat",
    sortOrder: 6,
  },
] as const;

export type TagSlug = (typeof curatedTags)[number]["slug"];
export type TagIconKey = (typeof curatedTags)[number]["iconKey"];
export type TagDefinition = (typeof curatedTags)[number];

const tagsBySlug = new Map<string, TagDefinition>(
  curatedTags.map((tag) => [tag.slug, tag]),
);
const legacyTagAliases = new Map<string, TagSlug>([
  ["date night", "date-night"],
  ["date-night", "date-night"],
  ["with friends & family", "friends-family"],
  ["with friends and family", "friends-family"],
  ["friends-family", "friends-family"],
  ["archie friendly", "archie-friendly"],
  ["archie-friendly", "archie-friendly"],
  ["seasonal", "seasonal"],
  ["rainy day", "rainy-day"],
  ["rainy-day", "rainy-day"],
  ["recurring", "recurring"],
]);

export function isTagSlug(value: unknown): value is TagSlug {
  return typeof value === "string" && tagsBySlug.has(value);
}

export function tagDefinition(slug: string) {
  return tagsBySlug.get(slug);
}

export function normalizeTagSlugs(values: readonly unknown[] | null | undefined) {
  const slugs = new Set<TagSlug>();
  for (const value of values ?? []) {
    if (typeof value !== "string") continue;
    const normalized = legacyTagAliases.get(value.trim().toLocaleLowerCase());
    if (normalized) slugs.add(normalized);
  }
  return curatedTags
    .filter((tag) => slugs.has(tag.slug))
    .map((tag) => tag.slug);
}

export function tagIdsForSlugs(values: readonly string[]) {
  const selected = new Set(normalizeTagSlugs(values));
  return curatedTags
    .filter((tag) => selected.has(tag.slug))
    .map((tag) => tag.id);
}

export function hasTag(values: readonly string[], slug: TagSlug) {
  return values.includes(slug);
}

export function toggleTag(values: readonly string[], slug: TagSlug) {
  const selected = new Set(normalizeTagSlugs(values));
  if (selected.has(slug)) selected.delete(slug);
  else selected.add(slug);
  return curatedTags
    .filter((tag) => selected.has(tag.slug))
    .map((tag) => tag.slug);
}
