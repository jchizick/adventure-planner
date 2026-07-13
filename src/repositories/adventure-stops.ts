import { supabase } from "../lib/supabase";
import type { AdventureStop } from "../types";

type StopRow = {
  id: string;
  adventure_id: string;
  title: string;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  sort_order: number;
  travel_time_minutes: number | null;
};

export type StopDraft = Omit<AdventureStop, "id" | "sortOrder">;
const columns =
  "id, adventure_id, title, location, start_time, end_time, notes, sort_order, travel_time_minutes";

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

function mapStop(row: StopRow): AdventureStop {
  return {
    id: row.id,
    title: row.title,
    location: row.location ?? "",
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

function writable(draft: StopDraft) {
  return {
    title: draft.title.trim(),
    location: draft.location.trim() || null,
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
    .select(columns)
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
    .select(columns)
    .single();
  if (error) throw repositoryError("create", error);
  return mapStop(data as StopRow);
}

export async function updateStop(
  adventureId: string,
  stopId: string,
  draft: StopDraft,
) {
  const { data, error } = await supabase
    .from("adventure_stops")
    .update(writable(draft))
    .eq("adventure_id", adventureId)
    .eq("id", stopId)
    .select(columns)
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
