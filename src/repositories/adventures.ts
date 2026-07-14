import { supabase } from "../lib/supabase";
import { normalizeCategoryOrNull } from "../idea-model";
import { resolveMemberDisplayName } from "../member-names";
import {
  geocodeAdventureLocation,
  type AdventureCoordinates,
} from "./geocoding";
import type {
  Adventure,
  AdventureCoverSelection,
  AdventureCoverVariant,
  AdventurePlanInput,
  AdventureStatus,
} from "../types";

type DatabaseAdventureStatus = "tentative" | "confirmed" | "completed";
type ProfileJoin =
  { display_name: string | null } | { display_name: string | null }[] | null;

type AdventureRow = {
  id: string;
  space_id: string;
  source_idea_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  status: DatabaseAdventureStatus;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  geocoded_location: string | null;
  notes: string | null;
  cover_image_url: string | null;
  cover_variant: number | null;
  is_favorite: boolean;
  completed_at: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  creator_profile?: ProfileJoin;
  updater_profile?: ProfileJoin;
};

const adventureColumns = `
  id, space_id, source_idea_id, title, description, category, status,
  event_date, start_time, end_time, location, latitude, longitude, timezone,
  geocoded_location, notes, cover_image_url, cover_variant,
  is_favorite, completed_at, created_by, updated_by, created_at, updated_at,
  creator_profile:profiles!adventures_created_by_fkey(display_name),
  updater_profile:profiles!adventures_updated_by_fkey(display_name)
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
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    date: row.event_date,
    startTime: displayTime(row.start_time),
    endTime: displayTime(row.end_time),
    status: databaseToUiStatus[row.status],
    coverImage: row.cover_image_url ?? undefined,
    coverVariant: normalizeCoverVariant(row.cover_variant),
    location: row.location ?? "Location to be decided",
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    timezone: row.timezone ?? undefined,
    geocodedLocation: row.geocoded_location ?? undefined,
    category: normalizeCategoryOrNull(row.category) ?? undefined,
    sourceIdeaId: row.source_idea_id ?? undefined,
    stops: [],
    notes: row.notes ?? "",
    links: [],
    checklist: [],
    addedBy: profileName(row.creator_profile),
    updatedBy: profileName(row.updater_profile ?? row.creator_profile),
    completed: row.status === "completed" || row.completed_at !== null,
    completedAt: row.completed_at ?? undefined,
    favorite: row.is_favorite,
  };
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

const locationWarning =
  "Location saved, but weather could not be enabled for this address.";

function coordinatePayload(coordinates: AdventureCoordinates | null) {
  return {
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    timezone: coordinates?.timezone ?? null,
    geocoded_location: coordinates?.geocodedLocation ?? null,
  };
}

function withLocationWarning(
  adventure: Adventure,
  shouldWarn: boolean,
): Adventure {
  return shouldWarn
    ? { ...adventure, locationWeatherWarning: locationWarning }
    : adventure;
}

export async function loadAdventures(spaceId: string): Promise<Adventure[]> {
  const { data, error } = await supabase
    .from("adventures")
    .select(adventureColumns)
    .eq("space_id", spaceId)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true });
  if (error) throw repositoryError("load", error);
  return ((data ?? []) as unknown as AdventureRow[]).map(mapAdventure);
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
  return data ? mapAdventure(data as unknown as AdventureRow) : null;
}

export async function createAdventure(
  spaceId: string,
  userId: string,
  plan: AdventurePlanInput,
): Promise<Adventure> {
  const location = plan.location.trim();
  const coordinates = location
    ? await geocodeAdventureLocation(spaceId, location)
    : null;
  const { data, error } = await supabase
    .from("adventures")
    .insert({
      space_id: spaceId,
      title: plan.title.trim(),
      description: plan.description.trim() || null,
      category: plan.category ?? "culture",
      status: uiToDatabaseStatus[plan.status],
      event_date: plan.date,
      start_time: plan.startTime,
      end_time: plan.endTime || null,
      location: location || null,
      ...coordinatePayload(coordinates),
      notes: plan.notes.trim() || null,
      cover_image_url: plan.coverImage?.trim() || null,
      cover_variant: plan.coverImage?.trim() ? null : plan.coverVariant ?? null,
      created_by: userId,
      updated_by: userId,
    })
    .select(adventureColumns)
    .single();
  if (error) throw repositoryError("create", error);
  return withLocationWarning(
    mapAdventure(data as unknown as AdventureRow),
    Boolean(location && !coordinates),
  );
}

export async function updateAdventure(
  spaceId: string,
  adventureId: string,
  userId: string,
  plan: AdventurePlanInput,
  preserveCompletion: boolean,
  previous: Adventure,
): Promise<Adventure> {
  const location = plan.location.trim();
  const previousLocation = previous.location === "Location to be decided"
    ? ""
    : previous.location.trim();
  const needsGeocoding = Boolean(
    location &&
      (location !== previousLocation ||
        previous.latitude === undefined ||
        previous.longitude === undefined ||
        !previous.timezone),
  );
  const coordinates = needsGeocoding
    ? await geocodeAdventureLocation(spaceId, location)
    : location && previous.latitude !== undefined &&
        previous.longitude !== undefined && previous.timezone
    ? {
        latitude: previous.latitude,
        longitude: previous.longitude,
        timezone: previous.timezone,
        geocodedLocation: previous.geocodedLocation ?? location,
      }
    : null;
  const payload: Record<string, unknown> = {
    title: plan.title.trim(),
    description: plan.description.trim() || null,
    category: plan.category ?? "culture",
    event_date: plan.date,
    start_time: plan.startTime,
    end_time: plan.endTime || null,
    location: location || null,
    ...coordinatePayload(coordinates),
    notes: plan.notes.trim() || null,
    cover_image_url: plan.coverImage?.trim() || null,
    cover_variant: plan.coverImage?.trim() ? null : plan.coverVariant ?? null,
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
  return withLocationWarning(
    mapAdventure(data as unknown as AdventureRow),
    Boolean(needsGeocoding && !coordinates),
  );
}

export async function updateAdventureCover(
  spaceId: string,
  adventureId: string,
  userId: string,
  selection: AdventureCoverSelection,
): Promise<Adventure> {
  const coverImage = selection.coverImage?.trim() || null;
  const { data, error } = await supabase
    .from("adventures")
    .update({
      cover_image_url: coverImage,
      cover_variant: coverImage ? null : selection.coverVariant ?? null,
      updated_by: userId,
    })
    .eq("space_id", spaceId)
    .eq("id", adventureId)
    .select(adventureColumns)
    .single();
  if (error) throw repositoryError("update the cover for", error);
  return mapAdventure(data as unknown as AdventureRow);
}

export async function enableAdventureWeather(
  spaceId: string,
  adventureId: string,
  userId: string,
  adventure: Adventure,
): Promise<Adventure> {
  const location = adventure.location === "Location to be decided"
    ? ""
    : adventure.location.trim();
  if (!location) throw new Error("Add a location before enabling weather.");
  const coordinates = await geocodeAdventureLocation(spaceId, location);
  if (!coordinates)
    throw new Error("Weather could not be enabled for this location. Try again.");
  const { data, error } = await supabase
    .from("adventures")
    .update({ ...coordinatePayload(coordinates), updated_by: userId })
    .eq("space_id", spaceId)
    .eq("id", adventureId)
    .select(adventureColumns)
    .single();
  if (error) throw repositoryError("enable weather for", error);
  return mapAdventure(data as unknown as AdventureRow);
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
}

export async function promoteIdea(
  spaceId: string,
  ideaId: string,
  plan: AdventurePlanInput,
): Promise<Adventure> {
  const location = plan.location.trim();
  const coordinates = location
    ? await geocodeAdventureLocation(spaceId, location)
    : null;
  const { data, error } = await supabase.rpc("promote_idea_to_adventure", {
    p_idea_id: ideaId,
    p_title: plan.title.trim(),
    p_description: plan.description.trim(),
    p_event_date: plan.date,
    p_start_time: plan.startTime,
    p_end_time: plan.endTime || null,
    p_status: uiToDatabaseStatus[plan.status],
    p_location: location || null,
    p_notes: plan.notes.trim() || null,
    p_category: plan.category ?? null,
    p_cover_image_url: plan.coverImage?.trim() || null,
  });
  if (error) throw repositoryError("promote", error);
  const row = data as unknown as AdventureRow;
  let loaded = await loadAdventure(spaceId, row.id);
  if (!loaded)
    throw new Error("The Adventure was created but could not be opened.");
  if (coordinates) {
    const { data: updated, error: coordinateError } = await supabase
      .from("adventures")
      .update(coordinatePayload(coordinates))
      .eq("space_id", spaceId)
      .eq("id", loaded.id)
      .select(adventureColumns)
      .single();
    if (!coordinateError && updated)
      loaded = mapAdventure(updated as unknown as AdventureRow);
    else
      return withLocationWarning(loaded, true);
  }
  return withLocationWarning(loaded, Boolean(location && !coordinates));
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
  return mapAdventure(data as unknown as AdventureRow);
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
  return mapAdventure(data as unknown as AdventureRow);
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
  return mapAdventure(data as unknown as AdventureRow);
}
