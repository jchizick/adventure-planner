import { supabase } from "../lib/supabase";
import { isLegacyDateNightCategory, normalizeCategory } from "../idea-model";
import { resolveMemberDisplayName } from "../member-names";
import {
  isIdeaCoverPresetId,
  resolveNewIdeaCoverPreset,
} from "../idea-covers";
import type { Idea, IdeaStatus } from "../types";
import { normalizeIdeaUrl } from "../idea-url";
import {
  bestEffortCoverCleanup,
  removeCoverObject,
  signedCoverUrl,
  uploadCoverFile,
} from "../cover-storage";
import { normalizeTagSlugs, tagIdsForSlugs } from "../tag-model";

type DatabaseIdeaStatus = "idea" | "tentative" | "confirmed";

type IdeaRow = {
  id: string;
  space_id: string;
  title: string;
  description: string | null;
  category: string;
  status: DatabaseIdeaStatus;
  tags: string[];
  idea_tags?: {
    tag:
      | { slug: string; sort_order: number }
      | { slug: string; sort_order: number }[]
      | null;
  }[];
  optional_link: string | null;
  image_url: string | null;
  cover_preset_id: string | null;
  cover_storage_path: string | null;
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
> & {
  coverPresetId?: string | null;
  coverStoragePath?: string;
  pendingCoverFile?: File;
};

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
  cover_storage_path,
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
  idea_tags(tag:tags(slug, sort_order)),
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

async function mapIdea(row: IdeaRow, forceCoverRefresh = false): Promise<Idea> {
  const addedByProfile = Array.isArray(row.added_by_profile)
    ? row.added_by_profile[0]
    : row.added_by_profile;
  const linkedAdventure = Array.isArray(row.linked_adventure)
    ? row.linked_adventure[0]
    : row.linked_adventure;
  const coverUrl = row.cover_storage_path
    ? await signedCoverUrl(row.cover_storage_path, forceCoverRefresh)
    : undefined;
  const hasRelationalAssignments = Array.isArray(row.idea_tags);
  const relationalTags = (row.idea_tags ?? [])
    .flatMap((assignment) =>
      Array.isArray(assignment.tag) ? assignment.tag : [assignment.tag],
    )
    .filter((tag): tag is { slug: string; sort_order: number } => Boolean(tag))
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((tag) => tag.slug);
  const tags = normalizeTagSlugs([
    ...relationalTags,
    ...(hasRelationalAssignments ? [] : row.tags),
    ...(hasRelationalAssignments ? [] :
      row.is_date_night === true || isLegacyDateNightCategory(row.category)
        ? ["date-night"]
        : []
    ),
  ]);
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    description: row.description ?? "",
    category: normalizeCategory(row.category),
    status: databaseToUiStatus[row.status],
    tags,
    addedBy: resolveMemberDisplayName({
      displayName: addedByProfile?.display_name,
    }),
    addedByUserId: row.added_by,
    isDateNight: tags.includes("date-night"),
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
    coverStoragePath: row.cover_storage_path ?? undefined,
    coverUrl,
    optionalLocation: row.location ?? undefined,
    linkedAdventureId: row.linked_adventure_id ?? undefined,
  };
}

function writableFields(draft: IdeaDraft, uploadedPath?: string) {
  const normalizedUrl = normalizeIdeaUrl(draft.optionalLink);
  if (normalizedUrl.error) throw new Error(normalizedUrl.error);
  const coverStoragePath = (uploadedPath ?? draft.coverStoragePath?.trim()) || null;
  const externalImage = coverStoragePath ? null : draft.optionalImage?.trim() || null;
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    category: isLegacyDateNightCategory(String(draft.category))
      ? "social"
      : normalizeCategory(String(draft.category)),
    status: uiToDatabaseStatus[draft.status],
    optional_link: normalizedUrl.url ?? null,
    image_url: externalImage,
    cover_storage_path: coverStoragePath,
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
    ...((coverStoragePath || externalImage)
      ? { cover_preset_id: null }
      : draft.coverPresetId === null
      ? { cover_preset_id: null }
      : isIdeaCoverPresetId(draft.coverPresetId)
        ? { cover_preset_id: draft.coverPresetId }
        : {}),
  };
}

function normalizedDraftTags(draft: IdeaDraft) {
  return normalizeTagSlugs([
    ...(draft.tags ?? []),
    ...(
      draft.isDateNight || isLegacyDateNightCategory(String(draft.category))
        ? ["date-night"]
        : []
    ),
  ]);
}

async function replaceIdeaTags(ideaId: string, tags: readonly string[]) {
  const { error } = await supabase.rpc("set_idea_tags", {
    p_idea_id: ideaId,
    p_tag_ids: tagIdsForSlugs(tags),
  });
  if (error) throw repositoryError("save tags for", error);
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
  return Promise.all(((data ?? []) as unknown as IdeaRow[]).map((row) => mapIdea(row)));
}

export async function createIdea(
  spaceId: string,
  userId: string,
  draft: IdeaDraft,
): Promise<Idea> {
  const id = crypto.randomUUID();
  let uploadedPath: string | undefined;
  if (draft.pendingCoverFile)
    uploadedPath = await uploadCoverFile({
      spaceId,
      recordType: "ideas",
      recordId: id,
      file: draft.pendingCoverFile,
    });
  try {
    const coverPresetId = uploadedPath || draft.coverStoragePath || draft.optionalImage
      ? null
      : resolveNewIdeaCoverPreset({
          id,
          category: draft.category,
          title: draft.title,
          description: draft.description,
          tags: normalizedDraftTags(draft),
          coverPresetId: draft.coverPresetId,
        }).id;
    const { data, error } = await supabase
      .from("ideas")
      .insert({
        ...writableFields(draft, uploadedPath),
        id,
        space_id: spaceId,
        added_by: userId,
        cover_preset_id: coverPresetId,
      })
      .select(ideaColumns)
      .single();
    if (error) throw repositoryError("save", error);
    const tags = normalizedDraftTags(draft);
    await replaceIdeaTags(id, tags);
    const saved = await mapIdea(data as unknown as IdeaRow);
    return { ...saved, tags, isDateNight: tags.includes("date-night") };
  } catch (error) {
    if (uploadedPath) await removeCoverObject(uploadedPath).catch(() => undefined);
    throw error;
  }
}

export async function updateIdea(
  spaceId: string,
  ideaId: string,
  draft: IdeaDraft,
  previous?: Idea,
): Promise<Idea> {
  let uploadedPath: string | undefined;
  if (draft.pendingCoverFile)
    uploadedPath = await uploadCoverFile({
      spaceId,
      recordType: "ideas",
      recordId: ideaId,
      file: draft.pendingCoverFile,
    });
  try {
    const { data, error } = await supabase
      .from("ideas")
      .update(writableFields(draft, uploadedPath))
      .eq("id", ideaId)
      .eq("space_id", spaceId)
      .select(ideaColumns)
      .single();
    if (error) throw repositoryError("update", error);
    const tags = normalizedDraftTags(draft);
    await replaceIdeaTags(ideaId, tags);
    const mapped = await mapIdea(data as unknown as IdeaRow);
    const saved = { ...mapped, tags, isDateNight: tags.includes("date-night") };
    if (previous?.coverStoragePath !== saved.coverStoragePath)
      void bestEffortCoverCleanup(previous?.coverStoragePath);
    return saved;
  } catch (error) {
    if (uploadedPath) await removeCoverObject(uploadedPath).catch(() => undefined);
    throw error;
  }
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
  coverStoragePath?: string,
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
  void bestEffortCoverCleanup(coverStoragePath);
}

export async function refreshIdeaCover(idea: Idea) {
  if (!idea.coverStoragePath) return idea;
  return {
    ...idea,
    coverUrl: await signedCoverUrl(idea.coverStoragePath, true),
  };
}
