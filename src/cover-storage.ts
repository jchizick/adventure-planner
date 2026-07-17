import { supabase } from "./lib/supabase";

export const COVER_IMAGE_BUCKET = "cover-images";
export const MAX_COVER_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_COVER_IMAGE_EDGE = 1800;
export const COVER_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

type CoverImageType = (typeof COVER_IMAGE_TYPES)[number];
type CoverRecordType = "ideas" | "adventures";

const extensionsByType: Record<CoverImageType, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export function validateCoverFile(file: File): CoverImageType {
  if (!file.size) throw new Error("Choose a non-empty image file.");
  if (file.size > MAX_COVER_IMAGE_BYTES)
    throw new Error("Choose an image smaller than 10 MB.");
  if (!COVER_IMAGE_TYPES.includes(file.type as CoverImageType))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const mimeType = file.type as CoverImageType;
  if (extension && !extensionsByType[mimeType].includes(extension))
    throw new Error("The image extension does not match its file type.");
  return mimeType;
}

export function constrainedCoverDimensions(
  width: number,
  height: number,
  maxEdge = MAX_COVER_IMAGE_EDGE,
) {
  if (!(width > 0) || !(height > 0))
    throw new Error("We could not read this image’s dimensions.");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function loadImage(file: File) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await image.decode();
  return {
    source: image as CanvasImageSource,
    width: image.naturalWidth,
    height: image.naturalHeight,
    close: () => URL.revokeObjectURL(objectUrl),
  };
}

export async function processCoverFile(file: File): Promise<File> {
  validateCoverFile(file);
  let decoded: Awaited<ReturnType<typeof loadImage>> | undefined;
  try {
    decoded = await loadImage(file);
    const dimensions = constrainedCoverDimensions(decoded.width, decoded.height);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.fillStyle = "#f7f3ed";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86),
    );
    if (!blob) throw new Error("We could not prepare this image for upload.");
    return new File([blob], `${crypto.randomUUID()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("We could not prepare this image for upload.", { cause: error });
  } finally {
    decoded?.close();
  }
}

export function coverStoragePath(
  spaceId: string,
  recordType: CoverRecordType,
  recordId: string,
  fileId = crypto.randomUUID(),
) {
  return `spaces/${spaceId}/${recordType}/${recordId}/cover/${fileId}.jpg`;
}

export async function uploadCoverFile({
  spaceId,
  recordType,
  recordId,
  file,
}: {
  spaceId: string;
  recordType: CoverRecordType;
  recordId: string;
  file: File;
}) {
  const processed = await processCoverFile(file);
  const storagePath = coverStoragePath(spaceId, recordType, recordId);
  const { error } = await supabase.storage
    .from(COVER_IMAGE_BUCKET)
    .upload(storagePath, processed, {
      cacheControl: "31536000",
      contentType: processed.type,
      upsert: false,
    });
  if (error) {
    if (import.meta.env.DEV)
      console.error("Supabase cover upload failed", error.message);
    throw new Error("We could not upload this cover. Please try again.");
  }
  return storagePath;
}

export async function signedCoverUrl(storagePath: string, force = false) {
  const cached = signedUrlCache.get(storagePath);
  if (!force && cached && cached.expiresAt > Date.now() + 5 * 60 * 1000)
    return cached.url;
  const { data, error } = await supabase.storage
    .from(COVER_IMAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) {
    if (import.meta.env.DEV)
      console.error("Supabase cover signing failed", error?.message);
    signedUrlCache.delete(storagePath);
    return undefined;
  }
  signedUrlCache.set(storagePath, {
    url: data.signedUrl,
    expiresAt: Date.now() + 60 * 60 * 1000,
  });
  return data.signedUrl;
}

export async function removeCoverObject(storagePath: string) {
  signedUrlCache.delete(storagePath);
  const { error } = await supabase.storage
    .from(COVER_IMAGE_BUCKET)
    .remove([storagePath]);
  if (error) throw error;
}

export async function cleanupCoverIfUnreferenced(storagePath?: string) {
  if (!storagePath) return;
  const [ideas, adventures] = await Promise.all([
    supabase.from("ideas").select("id").eq("cover_storage_path", storagePath).limit(1),
    supabase.from("adventures").select("id").eq("cover_storage_path", storagePath).limit(1),
  ]);
  if (ideas.error || adventures.error) throw ideas.error ?? adventures.error;
  if ((ideas.data?.length ?? 0) || (adventures.data?.length ?? 0)) return;
  await removeCoverObject(storagePath);
}

export async function bestEffortCoverCleanup(storagePath?: string) {
  try {
    await cleanupCoverIfUnreferenced(storagePath);
  } catch (error) {
    if (import.meta.env.DEV)
      console.error(
        "Supabase unused cover cleanup failed",
        error instanceof Error ? error.message : error,
      );
  }
}
