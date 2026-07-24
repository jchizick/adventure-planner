import { supabase } from "../lib/supabase";
import {
  isLegacyDateNightCategory,
  normalizeCategory,
  normalizeCategoryOrNull,
} from "../idea-model";
import { resolveMemberDisplayName } from "../member-names";
import {
  bestEffortCoverCleanup,
  removeCoverObject,
  signedCoverUrl,
  uploadCoverFile,
} from "../cover-storage";
import {
  buildLocationWritePayload,
  locationDraftForPersistence,
  mapSavedLocation,
  type LocationWritePayload,
} from "../location";
import type {
  Adventure,
  AdventureCoverSelection,
  AdventureCoverVariant,
  AdventurePlanInput,
  AdventureStatus,
  SavedLocation,
} from "../types";
import { normalizeTagSlugs, tagIdsForSlugs } from "../tag-model";

type DatabaseAdventureStatus = "tentative" | "confirmed" | "completed";
type ProfileJoin =
  { display_name: string | null } | { display_name: string | null }[] | null;

export type AdventureRow = {
  id: string;
  space_id: string;
  source_idea_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: DatabaseAdventureStatus;
  event_date: string;
  end_date?: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  geocoded_location: string | null;
  location_provider: string | null;
  location_provider_id: string | null;
  location_address: unknown;
  location_source: unknown;
  location_confirmed_at: string | null;
  notes: string | null;
  cover_image_url: string | null;
  cover_variant: number | null;
  cover_storage_path?: string | null;
  is_favorite: boolean;
  completed_at: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  creator_profile?: ProfileJoin;
  updater_profile?: ProfileJoin;
  adventure_tags?: {
    tag:
      | { slug: string; sort_order: number }
      | { slug: string; sort_order: number }[]
      | null;
  }[];
};

export const adventureColumns = `
  id, space_id, source_idea_id, title, description, category, status,
  event_date, end_date, start_time, end_time, location, latitude, longitude, timezone,
  geocoded_location, location_provider, location_provider_id,
  location_address, location_source, location_confirmed_at,
  notes, cover_image_url, cover_variant, cover_storage_path,
  is_favorite, completed_at, created_by, updated_by, created_at, updated_at,
  creator_profile:profiles!adventures_created_by_fkey(display_name),
  updater_profile:profiles!adventures_updated_by_fkey(display_name),
  adventure_tags(tag:tags(slug, sort_order))
`;

const databaseToUiStatus: Record<DatabaseAdventureStatus, AdventureStatus> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  completed: "Completed",
};

const uiToDatabaseStatus: Record<
  Exclude<AdventureStatus, "Completed">,
  Exclude<DatabaseAdventureStatus, "completed">
> = { Tentative: "tentative", Confirmed: "confirmed" };

function profileName(join: ProfileJoin | undefined) {
  const profile = Array.isArray(join) ? join[0] : join;
  return resolveMemberDisplayName({ displayName: profile?.display_name });
}

function displayTime(value: string | null) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function mapAdventure(row: AdventureRow): Adventure {
  const savedLocation = mapSavedLocation(row);
  const tags = normalizeTagSlugs(
    (row.adventure_tags ?? [])
      .flatMap((assignment) =>
        Array.isArray(assignment.tag) ? assignment.tag : [assignment.tag],
      )
      .filter((tag): tag is { slug: string; sort_order: number } => Boolean(tag))
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((tag) => tag.slug),
  );
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    date: row.event_date,
    endDate: row.end_date ?? undefined,
    startTime: displayTime(row.start_time),
    endTime: displayTime(row.end_time),
    status: databaseToUiStatus[row.status],
    coverImage: row.cover_image_url ?? undefined,
    coverVariant: normalizeCoverVariant(row.cover_variant),
    coverStoragePath: row.cover_storage_path ?? undefined,
    location: row.location ?? "Location to be decided",
    savedLocation,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    timezone: row.timezone ?? undefined,
    geocodedLocation: row.geocoded_location ?? undefined,
    category: normalizeCategoryOrNull(row.category) ?? undefined,
    tags,
    sourceIdeaId: row.source_idea_id ?? undefined,
    stops: [],
    notes: row.notes ?? "",
    links: [],
    checklist: [],
    addedBy: profileName(row.creator_profile),
    updatedBy: profileName(row.updater_profile ?? row.creator_profile),
    updatedAt: row.updated_at,
    completed: row.status === "completed" || row.completed_at !== null,
    completedAt: row.completed_at ?? undefined,
    favorite: row.is_favorite,
  };
}

async function replaceAdventureTags(
  adventureId: string,
  tags: readonly string[],
) {
  const { error } = await supabase.rpc("set_adventure_tags", {
    p_adventure_id: adventureId,
    p_tag_ids: tagIdsForSlugs(tags),
  });
  if (error) throw repositoryError("save tags for", error);
}

function normalizedPlanCategory(plan: AdventurePlanInput) {
  return isLegacyDateNightCategory(String(plan.category))
    ? "social"
    : normalizeCategory(String(plan.category ?? "culture"));
}

function normalizedPlanTags(plan: AdventurePlanInput) {
  return normalizeTagSlugs([
    ...(plan.tags ?? []),
    ...(isLegacyDateNightCategory(String(plan.category)) ? ["date-night"] : []),
  ]);
}

async function mapAdventureWithCover(
  row: AdventureRow,
  forceCoverRefresh = false,
) {
  const adventure = mapAdventure(row);
  return row.cover_storage_path
    ? {
        ...adventure,
        coverUrl: await signedCoverUrl(row.cover_storage_path, forceCoverRefresh),
      }
    : adventure;
}

function normalizeCoverVariant(
  value: number | null,
): AdventureCoverVariant | undefined {
  return value === 1 || value === 2 || value === 3 ? value : undefined;
}

function repositoryError(action: string, error: { message: string }) {
  if (import.meta.env.DEV)
    console.error(`Supabase Adventures ${action} failed`, error.message);
  return new Error(`We could not ${action} this adventure. Please try again.`);
}

export function adventureLocationPayload(
  plan: Pick<AdventurePlanInput, "location" | "locationDraft">,
  previous?: SavedLocation,
  confirmedAt = new Date().toISOString(),
): LocationWritePayload {
  return buildLocationWritePayload(
    locationDraftForPersistence(plan.location, plan.locationDraft, previous),
    { confirmedAt },
  );
}

export function promotionLocationRpcPayload(
  plan: Pick<AdventurePlanInput, "location" | "locationDraft">,
  confirmedAt = new Date().toISOString(),
) {
  const payload = adventureLocationPayload(plan, undefined, confirmedAt);
  return {
    p_location: payload.location ?? null,
    p_latitude: payload.latitude ?? null,
    p_longitude: payload.longitude ?? null,
    p_timezone: payload.timezone ?? null,
    p_geocoded_location: payload.geocoded_location ?? null,
    p_location_provider: payload.location_provider ?? null,
    p_location_provider_id: payload.location_provider_id ?? null,
    p_location_address: payload.location_address ?? null,
    p_location_source: payload.location_source ?? null,
    p_location_confirmed_at: payload.location_confirmed_at ?? null,
  };
}

export async function loadAdventures(spaceId: string): Promise<Adventure[]> {
  const { data, error } = await supabase
    .from("adventures")
    .select(adventureColumns)
    .eq("space_id", spaceId)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw repositoryError("load", error);
  return Promise.all(
    ((data ?? []) as unknown as AdventureRow[]).map((row) => mapAdventureWithCover(row)),
  );
}

export async function loadAdventure(
  spaceId: string,
  adventureId: string,
): Promise<Adventure | null> {
  const { data, error } = await supabase
    .from("adventures")
    .select(adventureColumns)
    .eq("space_id", spaceId)
    .eq("id", adventureId)
    .maybeSingle();
  if (error) throw repositoryError("load", error);
  return data ? mapAdventureWithCover(data as unknown as AdventureRow) : null;
}

export async function createAdventure(
  spaceId: string,
  userId: string,
  plan: AdventurePlanInput,
): Promise<Adventure> {
  const adventureId = crypto.randomUUID();
  let uploadedPath: string | undefined;
  if (plan.coverUploadFile)
    uploadedPath = await uploadCoverFile({
      spaceId,
      recordType: "adventures",
      recordId: adventureId,
      file: plan.coverUploadFile,
    });
  const coverStoragePath = (uploadedPath ?? plan.coverStoragePath?.trim()) || null;
  const coverImage = coverStoragePath ? null : plan.coverImage?.trim() || null;
  try {
    const locationPayload = adventureLocationPayload(plan);
    const { data, error } = await supabase
      .from("adventures")
      .insert({
        id: adventureId,
        space_id: spaceId,
        title: plan.title.trim(),
        description: plan.description.trim() || null,
        category: normalizedPlanCategory(plan),
        status: uiToDatabaseStatus[plan.status],
        event_date: plan.date,
        end_date: plan.endDate || null,
        start_time: plan.startTime || null,
        end_time: plan.endTime || null,
        ...locationPayload,
        notes: plan.notes.trim() || null,
        cover_image_url: coverImage,
        cover_variant: coverImage || coverStoragePath ? null : plan.coverVariant ?? null,
        cover_storage_path: coverStoragePath,
        created_by: userId,
        updated_by: userId,
      })
      .select(adventureColumns)
      .single();
    if (error) throw repositoryError("create", error);
    const tags = normalizedPlanTags(plan);
    await replaceAdventureTags(adventureId, tags);
    const saved = await mapAdventureWithCover(data as unknown as AdventureRow);
    return { ...saved, tags };
  } catch (error) {
    if (uploadedPath) await removeCoverObject(uploadedPath).catch(() => undefined);
    throw error;
  }
}

export async function updateAdventure(
  spaceId: string,
  adventureId: string,
  userId: string,
  plan: AdventurePlanInput,
  preserveCompletion: boolean,
  previous: Adventure,
): Promise<Adventure> {
  let uploadedPath: string | undefined;
  if (plan.coverUploadFile)
    uploadedPath = await uploadCoverFile({
      spaceId,
      recordType: "adventures",
      recordId: adventureId,
      file: plan.coverUploadFile,
    });
  const coverStoragePath = (uploadedPath ?? plan.coverStoragePath?.trim()) || null;
  const coverImage = coverStoragePath ? null : plan.coverImage?.trim() || null;
  try {
    const payload: Record<string, unknown> = {
      title: plan.title.trim(),
      description: plan.description.trim() || null,
      category: normalizedPlanCategory(plan),
      event_date: plan.date,
      end_date: plan.endDate || null,
      start_time: plan.startTime || null,
      end_time: plan.endTime || null,
      ...adventureLocationPayload(plan, previous.savedLocation),
      notes: plan.notes.trim() || null,
      cover_image_url: coverImage,
      cover_variant: coverImage || coverStoragePath ? null : plan.coverVariant ?? null,
      cover_storage_path: coverStoragePath,
      updated_by: userId,
    };
    if (!preserveCompletion) payload.status = uiToDatabaseStatus[plan.status];
    const { data, error } = await supabase
      .from("adventures")
      .update(payload)
      .eq("space_id", spaceId)
      .eq("id", adventureId)
      .select(adventureColumns)
      .single();
    if (error) throw repositoryError("update", error);
    const tags = normalizedPlanTags(plan);
    await replaceAdventureTags(adventureId, tags);
    const mapped = await mapAdventureWithCover(data as unknown as AdventureRow);
    const saved = { ...mapped, tags };
    if (previous.coverStoragePath !== saved.coverStoragePath)
      void bestEffortCoverCleanup(previous.coverStoragePath);
    return saved;
  } catch (error) {
    if (uploadedPath) await removeCoverObject(uploadedPath).catch(() => undefined);
    throw error;
  }
}

export async function updateAdventureCover(
  spaceId: string,
  adventureId: string,
  userId: string,
  selection: AdventureCoverSelection,
  previous: Adventure,
): Promise<Adventure> {
  let uploadedPath: string | undefined;
  if (selection.uploadFile)
    uploadedPath = await uploadCoverFile({
      spaceId,
      recordType: "adventures",
      recordId: adventureId,
      file: selection.uploadFile,
    });
  const coverStoragePath = (uploadedPath ?? selection.coverStoragePath?.trim()) || null;
  const coverImage = coverStoragePath ? null : selection.coverImage?.trim() || null;
  try {
    const { data, error } = await supabase
      .from("adventures")
      .update({
        cover_image_url: coverImage,
        cover_variant: coverImage || coverStoragePath ? null : selection.coverVariant ?? null,
        cover_storage_path: coverStoragePath,
        updated_by: userId,
      })
      .eq("space_id", spaceId)
      .eq("id", adventureId)
      .select(adventureColumns)
      .single();
    if (error) throw repositoryError("update the cover for", error);
    const saved = await mapAdventureWithCover(data as unknown as AdventureRow);
    if (previous.coverStoragePath !== saved.coverStoragePath)
      void bestEffortCoverCleanup(previous.coverStoragePath);
    return saved;
  } catch (error) {
    if (uploadedPath) await removeCoverObject(uploadedPath).catch(() => undefined);
    throw error;
  }
}

export async function duplicateAdventure(
  spaceId: string,
  adventureId: string,
): Promise<Adventure> {
  const { data, error } = await supabase.rpc("duplicate_adventure", {
    p_adventure_id: adventureId,
  });
  if (error) throw repositoryError("duplicate", error);
  const duplicate = await loadAdventure(spaceId, data as string);
  if (!duplicate)
    throw new Error("The Adventure was duplicated but could not be opened.");
  return duplicate;
}

export async function deleteAdventure(
  spaceId: string,
  adventureId: string,
  coverStoragePath?: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("adventures")
    .delete()
    .eq("space_id", spaceId)
    .eq("id", adventureId)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw repositoryError("delete", error ?? { message: "Adventure not found" });
  void bestEffortCoverCleanup(coverStoragePath);
}

export async function promoteIdea(
  spaceId: string,
  ideaId: string,
  plan: AdventurePlanInput,
): Promise<Adventure> {
  let uploadedPath: string | undefined;
  if (plan.coverUploadFile)
    uploadedPath = await uploadCoverFile({
      spaceId,
      recordType: "ideas",
      recordId: ideaId,
      file: plan.coverUploadFile,
    });
  const coverStoragePath = (uploadedPath ?? plan.coverStoragePath?.trim()) || null;
  try {
    const locationPayload = promotionLocationRpcPayload(plan);
    const { data, error } = await supabase.rpc("promote_idea_to_adventure_v5", {
      p_idea_id: ideaId,
      p_title: plan.title.trim(),
      p_description: plan.description.trim(),
      p_event_date: plan.date,
      p_end_date: plan.endDate || null,
      p_start_time: plan.startTime || null,
      p_end_time: plan.endTime || null,
      p_status: uiToDatabaseStatus[plan.status],
      ...locationPayload,
      p_notes: plan.notes.trim() || null,
      p_category: normalizedPlanCategory(plan),
      p_cover_image_url: coverStoragePath ? null : plan.coverImage?.trim() || null,
      p_cover_storage_path: coverStoragePath,
      p_tag_ids: tagIdsForSlugs(normalizedPlanTags(plan)),
    });
    if (error) throw repositoryError("promote", error);
    const created = await mapAdventureWithCover(data as unknown as AdventureRow);
    return { ...created, tags: normalizedPlanTags(plan) };
  } catch (error) {
    if (uploadedPath) await removeCoverObject(uploadedPath).catch(() => undefined);
    throw error;
  }
}

export async function updateAdventureNotes(
  spaceId: string,
  adventureId: string,
  userId: string,
  notes: string,
): Promise<Adventure> {
  const { data, error } = await supabase
    .from("adventures")
    .update({ notes: notes.trim() || null, updated_by: userId })
    .eq("space_id", spaceId)
    .eq("id", adventureId)
    .select(adventureColumns)
    .single();
  if (error) throw repositoryError("update", error);
  return mapAdventureWithCover(data as unknown as AdventureRow);
}

export async function updateAdventureFavorite(
  spaceId: string,
  adventureId: string,
  userId: string,
  favorite: boolean,
): Promise<Adventure> {
  const { data, error } = await supabase
    .from("adventures")
    .update({ is_favorite: favorite, updated_by: userId })
    .eq("space_id", spaceId)
    .eq("id", adventureId)
    .select(adventureColumns)
    .single();
  if (error) throw repositoryError("update", error);
  return mapAdventureWithCover(data as unknown as AdventureRow);
}

export async function updateAdventureCompletion(
  spaceId: string,
  adventureId: string,
  userId: string,
  completed: boolean,
): Promise<Adventure> {
  const { data, error } = await supabase
    .from("adventures")
    .update({
      status: completed ? "completed" : "confirmed",
      completed_at: completed ? new Date().toISOString() : null,
      updated_by: userId,
    })
    .eq("space_id", spaceId)
    .eq("id", adventureId)
    .select(adventureColumns)
    .single();
  if (error) throw repositoryError(completed ? "complete" : "restore", error);
  return mapAdventureWithCover(data as unknown as AdventureRow);
}

export async function refreshAdventureCover(adventure: Adventure) {
  if (!adventure.coverStoragePath) return adventure;
  return {
    ...adventure,
    coverUrl: await signedCoverUrl(adventure.coverStoragePath, true),
  };
}
