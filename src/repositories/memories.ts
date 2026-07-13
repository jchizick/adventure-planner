import { supabase } from "../lib/supabase";
import { resolveMemberDisplayName } from "../member-names";
import type {
  AdventureMemory,
  MemoryPhoto,
  MemorySummary,
} from "../types";

export const MEMORY_PHOTO_BUCKET = "adventure-photos";
export const MAX_MEMORY_PHOTO_BYTES = 10 * 1024 * 1024;
export const MEMORY_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type ProfileJoin =
  | { display_name: string | null }
  | { display_name: string | null }[]
  | null;

type MemoryRow = {
  id: string;
  adventure_id: string;
  reflection: string;
  updated_at: string;
  updater_profile?: ProfileJoin;
};

type PhotoRow = {
  id: string;
  adventure_id: string;
  uploaded_by: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
  width: number | null;
  height: number | null;
  file_size: number;
  mime_type: MemoryPhoto["mimeType"];
  uploader_profile?: ProfileJoin;
};

function joinedDisplayName(join: ProfileJoin | undefined) {
  const profile = Array.isArray(join) ? join[0] : join;
  return resolveMemberDisplayName({ displayName: profile?.display_name });
}

function memoryError(action: string, error?: { message: string }) {
  if (import.meta.env.DEV && error)
    console.error(`Supabase Memories ${action} failed`, error.message);
  return new Error(`We could not ${action} this memory. Please try again.`);
}

async function signedUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(MEMORY_PHOTO_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl)
    throw memoryError("load a photo", error ?? undefined);
  return data.signedUrl;
}

async function mapPhoto(row: PhotoRow): Promise<MemoryPhoto> {
  return {
    id: row.id,
    adventureId: row.adventure_id,
    uploadedByUserId: row.uploaded_by,
    uploadedBy: joinedDisplayName(row.uploader_profile),
    storagePath: row.storage_path,
    caption: row.caption ?? undefined,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    url: await signedUrl(row.storage_path),
  };
}

const photoColumns = `
  id, adventure_id, uploaded_by, storage_path, caption, sort_order, created_at,
  width, height, file_size, mime_type,
  uploader_profile:profiles!adventure_photos_uploaded_by_fkey(display_name)
`;

export async function loadAdventureMemory(
  adventureId: string,
): Promise<AdventureMemory> {
  const [memoryResult, photoResult] = await Promise.all([
    supabase
      .from("adventure_memories")
      .select(`
        id, adventure_id, reflection, updated_at,
        updater_profile:profiles!adventure_memories_updated_by_fkey(display_name)
      `)
      .eq("adventure_id", adventureId)
      .maybeSingle(),
    supabase
      .from("adventure_photos")
      .select(photoColumns)
      .eq("adventure_id", adventureId)
      .order("sort_order", { ascending: true }),
  ]);
  if (memoryResult.error) throw memoryError("load", memoryResult.error);
  if (photoResult.error) throw memoryError("load", photoResult.error);
  const memory = memoryResult.data as unknown as MemoryRow | null;
  const photos = await Promise.all(
    ((photoResult.data ?? []) as unknown as PhotoRow[]).map(mapPhoto),
  );
  return {
    id: memory?.id,
    adventureId,
    reflection: memory?.reflection ?? "",
    updatedBy: memory ? joinedDisplayName(memory.updater_profile) : undefined,
    updatedAt: memory?.updated_at,
    photos,
  };
}

export async function loadMemorySummaries(
  adventureIds: string[],
): Promise<Record<string, MemorySummary>> {
  if (!adventureIds.length) return {};
  const [memoryResult, photoResult] = await Promise.all([
    supabase
      .from("adventure_memories")
      .select("adventure_id, reflection")
      .in("adventure_id", adventureIds),
    supabase
      .from("adventure_photos")
      .select("adventure_id, storage_path, sort_order")
      .in("adventure_id", adventureIds)
      .order("sort_order", { ascending: true }),
  ]);
  if (memoryResult.error || photoResult.error)
    throw memoryError("load", memoryResult.error ?? photoResult.error ?? undefined);
  const summaries: Record<string, MemorySummary> = Object.fromEntries(
    adventureIds.map((adventureId) => [
      adventureId,
      { adventureId, reflection: "", photoCount: 0 } satisfies MemorySummary,
    ]),
  );
  for (const row of memoryResult.data ?? [])
    summaries[row.adventure_id].reflection = row.reflection;
  const firstPaths = new Map<string, string>();
  for (const row of photoResult.data ?? []) {
    summaries[row.adventure_id].photoCount += 1;
    if (!firstPaths.has(row.adventure_id))
      firstPaths.set(row.adventure_id, row.storage_path);
  }
  await Promise.all(
    [...firstPaths].map(async ([adventureId, path]) => {
      summaries[adventureId].coverUrl = await signedUrl(path);
    }),
  );
  return summaries;
}

export async function saveMemoryReflection(
  adventureId: string,
  userId: string,
  reflection: string,
) {
  const { data, error } = await supabase
    .from("adventure_memories")
    .upsert(
      { adventure_id: adventureId, reflection, updated_by: userId },
      { onConflict: "adventure_id" },
    )
    .select(`
      id, adventure_id, reflection, updated_at,
      updater_profile:profiles!adventure_memories_updated_by_fkey(display_name)
    `)
    .single();
  if (error) throw memoryError("save", error);
  const row = data as unknown as MemoryRow;
  return {
    id: row.id,
    reflection: row.reflection,
    updatedAt: row.updated_at,
    updatedBy: joinedDisplayName(row.updater_profile),
  };
}

export async function uploadMemoryPhoto({
  adventureId,
  spaceId,
  userId,
  file,
}: {
  adventureId: string;
  spaceId: string;
  userId: string;
  file: File;
}): Promise<MemoryPhoto> {
  const photoId = crypto.randomUUID();
  const storagePath = `spaces/${spaceId}/adventures/${adventureId}/${photoId}/original`;
  const { data: lastPhoto, error: orderError } = await supabase
    .from("adventure_photos")
    .select("sort_order")
    .eq("adventure_id", adventureId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderError) throw memoryError("prepare the photo", orderError);
  const { error: uploadError } = await supabase.storage
    .from(MEMORY_PHOTO_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw memoryError("upload the photo", uploadError);
  const { data, error } = await supabase
    .from("adventure_photos")
    .insert({
      id: photoId,
      adventure_id: adventureId,
      uploaded_by: userId,
      storage_path: storagePath,
      sort_order: (lastPhoto?.sort_order ?? -1) + 1,
      file_size: file.size,
      mime_type: file.type,
    })
    .select(photoColumns)
    .single();
  if (error) {
    await supabase.storage.from(MEMORY_PHOTO_BUCKET).remove([storagePath]);
    throw memoryError("save the photo", error);
  }
  return mapPhoto(data as unknown as PhotoRow);
}

export async function deleteMemoryPhoto(photo: MemoryPhoto) {
  const { error: storageError } = await supabase.storage
    .from(MEMORY_PHOTO_BUCKET)
    .remove([photo.storagePath]);
  if (storageError) throw memoryError("delete the photo", storageError);
  const { error } = await supabase
    .from("adventure_photos")
    .delete()
    .eq("id", photo.id);
  if (error) throw memoryError("delete the photo", error);
}
