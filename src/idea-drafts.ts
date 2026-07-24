import {
  isLegacyDateNightCategory,
  normalizeCategory,
} from "./idea-model";
import { normalizeTagSlugs } from "./tag-model";
import type { Idea } from "./types";

const DRAFT_VERSION = 2;
export const IDEA_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type IdeaDraftScope = {
  userId: string;
  spaceId: string;
  mode: "create" | "edit" | "duplicate";
  ideaId?: string;
};

type EditableIdea = Pick<
  Idea,
  | "title"
  | "description"
  | "category"
  | "status"
  | "optionalLink"
  | "optionalImage"
  | "optionalLocation"
  | "coverPresetId"
  | "coverStoragePath"
  | "proposedStartDate"
  | "proposedStartTime"
  | "proposedEndDate"
  | "proposedEndTime"
> & {
  tags: string[];
  pendingCoverFileName?: string;
};

type StoredIdeaDraft = {
  version: 2;
  savedAt: number;
  baseUpdatedAt?: string;
  values: EditableIdea;
  coverUploadPending: boolean;
};

type LegacyStoredIdeaDraft = {
  version: 1;
  savedAt: number;
  baseUpdatedAt?: string;
  values: Omit<EditableIdea, "tags"> & {
    tags?: string[];
    isDateNight?: boolean;
    category: string;
  };
  coverUploadPending: boolean;
};

export type LoadedIdeaDraft =
  | { status: "none" }
  | { status: "stale" }
  | { status: "restored"; idea: Idea; photoNeedsReselection: boolean };

export function editableIdeaValues(idea: Idea): EditableIdea {
  return {
    title: idea.title,
    description: idea.description,
    category: idea.category,
    status: idea.status,
    tags: normalizeTagSlugs(idea.tags),
    optionalLink: idea.optionalLink,
    optionalImage: idea.optionalImage,
    optionalLocation: idea.optionalLocation,
    coverPresetId: idea.coverPresetId,
    coverStoragePath: idea.coverStoragePath,
    pendingCoverFileName: idea.pendingCoverFile?.name,
    proposedStartDate: idea.proposedStartDate,
    proposedStartTime: idea.proposedStartTime,
    proposedEndDate: idea.proposedEndDate,
    proposedEndTime: idea.proposedEndTime,
  };
}

export function ideaHasUnsavedChanges(current: Idea, baseline: Idea) {
  return JSON.stringify(editableIdeaValues(current)) !==
    JSON.stringify(editableIdeaValues(baseline));
}

function draftKey(scope: IdeaDraftScope, version: 1 | 2) {
  const record = scope.mode === "create"
    ? "new"
    : scope.mode === "edit"
      ? scope.ideaId || "unknown"
      : `duplicate:${scope.ideaId || "unknown"}`;
  return `our-adventures:idea-draft:v${version}:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.spaceId)}:${scope.mode}:${encodeURIComponent(record)}`;
}

export function ideaDraftKey(scope: IdeaDraftScope) {
  return draftKey(scope, DRAFT_VERSION);
}

function hasBaseDraftShape(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<StoredIdeaDraft | LegacyStoredIdeaDraft>;
  const values = draft.values as Partial<EditableIdea> | undefined;
  return (
    typeof draft.savedAt === "number" &&
    Boolean(values) &&
    typeof values?.title === "string" &&
    typeof values.description === "string" &&
    typeof values.category === "string" &&
    typeof values.status === "string" &&
    (values.optionalLink === undefined || typeof values.optionalLink === "string")
  );
}

function isStoredDraft(value: unknown): value is StoredIdeaDraft {
  if (!hasBaseDraftShape(value)) return false;
  const draft = value as Partial<StoredIdeaDraft>;
  return draft.version === DRAFT_VERSION &&
    Array.isArray(draft.values?.tags) &&
    draft.values.tags.every((tag) => typeof tag === "string");
}

function isLegacyStoredDraft(value: unknown): value is LegacyStoredIdeaDraft {
  if (!hasBaseDraftShape(value)) return false;
  const draft = value as Partial<LegacyStoredIdeaDraft>;
  return draft.version === 1 &&
    (draft.values?.tags === undefined ||
      (Array.isArray(draft.values.tags) &&
        draft.values.tags.every((tag) => typeof tag === "string"))) &&
    (draft.values?.isDateNight === undefined ||
      typeof draft.values.isDateNight === "boolean");
}

export function saveIdeaDraft(
  storage: Storage,
  scope: IdeaDraftScope,
  idea: Idea,
  now = Date.now(),
) {
  const payload: StoredIdeaDraft = {
    version: DRAFT_VERSION,
    savedAt: now,
    baseUpdatedAt: idea.updatedAt,
    values: editableIdeaValues(idea),
    coverUploadPending: Boolean(idea.pendingCoverFile),
  };
  storage.setItem(ideaDraftKey(scope), JSON.stringify(payload));
}

export function loadIdeaDraft(
  storage: Storage,
  scope: IdeaDraftScope,
  serverIdea: Idea,
  now = Date.now(),
): LoadedIdeaDraft {
  const currentKey = ideaDraftKey(scope);
  const legacyKey = draftKey(scope, 1);
  const raw = storage.getItem(currentKey) ?? storage.getItem(legacyKey);
  const loadedKey = storage.getItem(currentKey) ? currentKey : legacyKey;
  if (!raw) return { status: "none" };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      (!isStoredDraft(parsed) && !isLegacyStoredDraft(parsed)) ||
      now - parsed.savedAt > IDEA_DRAFT_MAX_AGE_MS
    ) {
      storage.removeItem(loadedKey);
      return { status: "none" };
    }
    if (
      scope.mode === "edit" &&
      parsed.baseUpdatedAt !== undefined &&
      parsed.baseUpdatedAt !== serverIdea.updatedAt
    ) {
      storage.removeItem(loadedKey);
      return { status: "stale" };
    }
    const {
      pendingCoverFileName: _pendingCoverFileName,
      ...storedValues
    } = parsed.values;
    void _pendingCoverFileName;
    const legacyDateNight = isLegacyStoredDraft(parsed) &&
      (parsed.values.isDateNight === true ||
        isLegacyDateNightCategory(parsed.values.category));
    const tags = normalizeTagSlugs([
      ...(parsed.values.tags ?? []),
      ...(legacyDateNight ? ["date-night"] : []),
    ]);
    const category = isLegacyDateNightCategory(parsed.values.category)
      ? "social"
      : normalizeCategory(parsed.values.category);
    const values = { ...storedValues, category, tags };
    delete (values as { isDateNight?: boolean }).isDateNight;
    if (loadedKey === legacyKey) {
      storage.removeItem(legacyKey);
    }
    return {
      status: "restored",
      idea: {
        ...serverIdea,
        ...values,
        tags,
        isDateNight: tags.includes("date-night"),
        pendingCoverFile: undefined,
      },
      photoNeedsReselection: parsed.coverUploadPending === true,
    };
  } catch {
    storage.removeItem(loadedKey);
    return { status: "none" };
  }
}

export function clearIdeaDraft(storage: Storage, scope: IdeaDraftScope) {
  storage.removeItem(ideaDraftKey(scope));
  storage.removeItem(draftKey(scope, 1));
}
