import { supabase } from "../lib/supabase";
import {
  buildLocationWritePayload,
  locationDraftForPersistence,
  mapSavedLocation,
  type LocationWritePayload,
} from "../location";
import type {
  AdventureStop,
  LocationDraft,
  SavedLocation,
} from "../types";

export type StopRow = {
  id: string;
  adventure_id: string;
  title: string;
  day_date: string;
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
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  sort_order: number;
  travel_time_minutes: number | null;
};

export type StopDraft = Omit<
  AdventureStop,
  "id" | "sortOrder" | "savedLocation"
> & { locationDraft?: LocationDraft };
export const stopColumns =
  "id, adventure_id, title, day_date, location, latitude, longitude, timezone, geocoded_location, location_provider, location_provider_id, location_address, location_source, location_confirmed_at, start_time, end_time, notes, sort_order, travel_time_minutes";

function displayTime(value: string | null) {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function inputTime(value: string) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return value;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
}

function travelMinutes(value?: string) {
  if (!value) return null;
  const minutes = Number.parseInt(value, 10);
  return Number.isFinite(minutes) ? minutes : null;
}

export function mapStop(row: StopRow): AdventureStop {
  return {
    id: row.id,
    title: row.title,
    dayDate: row.day_date,
    location: row.location ?? "",
    savedLocation: mapSavedLocation(row),
    startTime: displayTime(row.start_time),
    endTime: displayTime(row.end_time) || undefined,
    notes: row.notes ?? undefined,
    sortOrder: row.sort_order,
    optionalTravelTime:
      row.travel_time_minutes === null
        ? undefined
        : `${row.travel_time_minutes} min`,
  };
}

export function stopLocationPayload(
  draft: Pick<StopDraft, "location" | "locationDraft">,
  previous?: SavedLocation,
  confirmedAt = new Date().toISOString(),
): LocationWritePayload {
  return buildLocationWritePayload(
    locationDraftForPersistence(draft.location, draft.locationDraft, previous),
    { confirmedAt },
  );
}

function writable(draft: StopDraft, previous?: SavedLocation) {
  return {
    title: draft.title.trim(),
    day_date: draft.dayDate,
    ...stopLocationPayload(draft, previous),
    start_time: inputTime(draft.startTime),
    end_time: inputTime(draft.endTime ?? ""),
    notes: draft.notes?.trim() || null,
    travel_time_minutes: travelMinutes(draft.optionalTravelTime),
  };
}

function repositoryError(action: string, error: { message: string }) {
  if (import.meta.env.DEV)
    console.error(`Supabase stops ${action} failed`, error.message);
  return new Error(`We could not ${action} this stop. Please try again.`);
}

export async function loadStops(adventureId: string): Promise<AdventureStop[]> {
  const { data, error } = await supabase
    .from("adventure_stops")
    .select(stopColumns)
    .eq("adventure_id", adventureId)
    .order("sort_order", { ascending: true });
  if (error) throw repositoryError("load", error);
  return ((data ?? []) as StopRow[]).map(mapStop);
}

export async function createStop(
  adventureId: string,
  sortOrder: number,
  draft: StopDraft,
) {
  const { data, error } = await supabase
    .from("adventure_stops")
    .insert({
      adventure_id: adventureId,
      sort_order: sortOrder,
      ...writable(draft),
    })
    .select(stopColumns)
    .single();
  if (error) throw repositoryError("create", error);
  return mapStop(data as StopRow);
}

export async function updateStop(
  adventureId: string,
  stopId: string,
  draft: StopDraft,
  previous: AdventureStop,
) {
  const { data, error } = await supabase
    .from("adventure_stops")
    .update(writable(draft, previous.savedLocation))
    .eq("adventure_id", adventureId)
    .eq("id", stopId)
    .select(stopColumns)
    .single();
  if (error) throw repositoryError("update", error);
  return mapStop(data as StopRow);
}

export async function deleteStop(adventureId: string, stopId: string) {
  const { error } = await supabase
    .from("adventure_stops")
    .delete()
    .eq("adventure_id", adventureId)
    .eq("id", stopId);
  if (error) throw repositoryError("delete", error);
}

export async function reorderStops(adventureId: string, orderedIds: string[]) {
  const { error } = await supabase.rpc("reorder_adventure_stops", {
    p_adventure_id: adventureId,
    p_ordered_ids: orderedIds,
  });
  if (error) throw repositoryError("reorder", error);
}
