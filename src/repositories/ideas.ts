import { supabase } from "../lib/supabase";
import { isLegacyDateNightCategory, normalizeCategory } from "../idea-model";
import { resolveMemberDisplayName } from "../member-names";
import {
  isIdeaCoverPresetId,
  resolveNewIdeaCoverPreset,
} from "../idea-covers";
import type { Idea, IdeaStatus } from "../types";
import { normalizeIdeaUrl } from "../idea-url";

type DatabaseIdeaStatus = "idea" | "tentative" | "confirmed";

type IdeaRow = {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  category: string;
  status: DatabaseIdeaStatus;
  tags: string[];
  optional_link: string | null;
  image_url: string | null;
  cover_preset_id: string | null;
  location: string | null;
  proposed_start_date: string | null;
  proposed_start_time: string | null;
  proposed_end_date: string | null;
  proposed_end_time: string | null;
  added_by: string;
  linked_adventure_id: string | null;
  created_at: string;
  updated_at: string;
  is_date_night: boolean | null;
  linked_adventure:
    | { event_date: string | null }
    | { event_date: string | null }[]
    | null;
  added_by_profile:
    { display_name: string | null } | { display_name: string | null }[] | null;
};

export type IdeaDraft = Pick<
  Idea,
  | "title"
  | "description"
  | "category"
  | "status"
  | "tags"
  | "optionalLink"
  | "optionalImage"
  | "optionalLocation"
  | "proposedStartDate"
  | "proposedStartTime"
  | "proposedEndDate"
  | "proposedEndTime"
  | "isDateNight"
> & { coverPresetId?: string | null };

const ideaColumns = `
  id,
  space_id,
  title,
  description,
  category,
  status,
  tags,
  optional_link,
  image_url,
  cover_preset_id,
  location,
  proposed_start_date,
  proposed_start_time,
  proposed_end_date,
  proposed_end_time,
  added_by,
  linked_adventure_id,
  created_at,
  updated_at,
  is_date_night,
  linked_adventure:adventures!ideas_linked_adventure_id_fkey(event_date),
  added_by_profile:profiles!ideas_added_by_fkey(display_name)
`;

const databaseToUiStatus: Record<DatabaseIdeaStatus, IdeaStatus> = {
  idea: "Idea",
  tentative: "Tentative",
  confirmed: "Confirmed",
};

const uiToDatabaseStatus: Record<IdeaStatus, DatabaseIdeaStatus> = {
  Idea: "idea",
  Tentative: "tentative",
  Confirmed: "confirmed",
};

function mapIdea(row: IdeaRow): Idea {
  const addedByProfile = Array.isArray(row.added_by_profile)
    ? row.added_by_profile[0]
    : row.added_by_profile;
  const linkedAdventure = Array.isArray(row.linked_adventure)
    ? row.linked_adventure[0]
    : row.linked_adventure;
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    description: row.description ?? "",
    category: normalizeCategory(row.category),
    status: databaseToUiStatus[row.status],
    tags: row.tags,
    addedBy: resolveMemberDisplayName({
      displayName: addedByProfile?.display_name,
    }),
    addedByUserId: row.added_by,
    isDateNight:
      row.is_date_night === true || isLegacyDateNightCategory(row.category),
    scheduledFor: linkedAdventure?.event_date ?? row.proposed_start_date ?? undefined,
    proposedStartDate: row.proposed_start_date ?? undefined,
    proposedStartTime: row.proposed_start_time ?? undefined,
    proposedEndDate: row.proposed_end_date ?? undefined,
    proposedEndTime: row.proposed_end_time ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    optionalLink: row.optional_link ?? undefined,
    optionalImage: row.image_url ?? undefined,
    coverPresetId: row.cover_preset_id ?? undefined,
    optionalLocation: row.location ?? undefined,
    linkedAdventureId: row.linked_adventure_id ?? undefined,
  };
}

function writableFields(draft: IdeaDraft) {
  const normalizedUrl = normalizeIdeaUrl(draft.optionalLink);
  if (normalizedUrl.error) throw new Error(normalizedUrl.error);
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    category: draft.category,
    is_date_night: draft.isDateNight,
    status: uiToDatabaseStatus[draft.status],
    tags: draft.tags,
    optional_link: normalizedUrl.url ?? null,
    image_url: draft.optionalImage?.trim() || null,
    location: draft.optionalLocation?.trim() || null,
    proposed_start_date: draft.proposedStartDate || null,
    proposed_start_time: draft.proposedStartDate && draft.proposedStartTime
      ? draft.proposedStartTime
      : null,
    proposed_end_date: draft.proposedStartDate && draft.proposedEndDate
      ? draft.proposedEndDate
      : null,
    proposed_end_time:
      draft.proposedStartDate && draft.proposedEndDate && draft.proposedEndTime
        ? draft.proposedEndTime
        : null,
    ...(draft.coverPresetId === null
      ? { cover_preset_id: null }
      : isIdeaCoverPresetId(draft.coverPresetId)
        ? { cover_preset_id: draft.coverPresetId }
        : {}),
  };
}

function repositoryError(action: string, error: { message: string }) {
  if (import.meta.env.DEV)
    console.error(`Supabase Ideas ${action} failed`, error.message);
  return new Error(`We could not ${action} this idea. Please try again.`);
}

export async function loadIdeas(spaceId: string): Promise<Idea[]> {
  const { data, error } = await supabase
    .from("ideas")
    .select(ideaColumns)
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });
  if (error) throw repositoryError("load", error);
  return ((data ?? []) as unknown as IdeaRow[]).map(mapIdea);
}

export async function createIdea(
  spaceId: string,
  userId: string,
  draft: IdeaDraft,
): Promise<Idea> {
  const id = crypto.randomUUID();
  const coverPresetId = resolveNewIdeaCoverPreset({
    id,
    category: draft.category,
    title: draft.title,
    description: draft.description,
    isDateNight: draft.isDateNight,
    coverPresetId: draft.coverPresetId,
  }).id;
  const { data, error } = await supabase
    .from("ideas")
    .insert({
      ...writableFields(draft),
      id,
      space_id: spaceId,
      added_by: userId,
      cover_preset_id: coverPresetId,
    })
    .select(ideaColumns)
    .single();
  if (error) throw repositoryError("save", error);
  return mapIdea(data as unknown as IdeaRow);
}

export async function updateIdea(
  spaceId: string,
  ideaId: string,
  draft: IdeaDraft,
): Promise<Idea> {
  const { data, error } = await supabase
    .from("ideas")
    .update(writableFields(draft))
    .eq("id", ideaId)
    .eq("space_id", spaceId)
    .select(ideaColumns)
    .single();
  if (error) throw repositoryError("update", error);
  return mapIdea(data as unknown as IdeaRow);
}

export async function updateIdeaStatus(
  spaceId: string,
  ideaId: string,
  status: IdeaStatus,
): Promise<Idea> {
  const { data, error } = await supabase
    .from("ideas")
    .update({ status: uiToDatabaseStatus[status] })
    .eq("id", ideaId)
    .eq("space_id", spaceId)
    .select(ideaColumns)
    .single();
  if (error) throw repositoryError("update", error);
  return mapIdea(data as unknown as IdeaRow);
}

export async function deleteIdea(
  spaceId: string,
  ideaId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("ideas")
    .delete()
    .eq("space_id", spaceId)
    .eq("id", ideaId)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw repositoryError("delete", error ?? { message: "Idea not found" });
}
