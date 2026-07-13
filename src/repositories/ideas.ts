import { supabase } from "../lib/supabase";
import type { Category, Idea, IdeaStatus } from "../types";

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
  location: string | null;
  added_by: string;
  linked_adventure_id: string | null;
  created_at: string;
  updated_at: string;
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
>;

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
  location,
  added_by,
  linked_adventure_id,
  created_at,
  updated_at,
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
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    description: row.description ?? "",
    category: row.category as Category,
    status: databaseToUiStatus[row.status],
    tags: row.tags,
    addedBy: addedByProfile?.display_name?.trim() || "Adventure planner",
    addedById: row.added_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    optionalLink: row.optional_link ?? undefined,
    optionalImage: row.image_url ?? undefined,
    optionalLocation: row.location ?? undefined,
    linkedAdventureId: row.linked_adventure_id ?? undefined,
  };
}

function writableFields(draft: IdeaDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    category: draft.category,
    status: uiToDatabaseStatus[draft.status],
    tags: draft.tags,
    optional_link: draft.optionalLink?.trim() || null,
    image_url: draft.optionalImage?.trim() || null,
    location: draft.optionalLocation?.trim() || null,
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
  const { data, error } = await supabase
    .from("ideas")
    .insert({
      ...writableFields(draft),
      space_id: spaceId,
      added_by: userId,
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
