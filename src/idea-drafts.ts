import type { Idea } from "./types";

const DRAFT_VERSION = 1;
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
  | "tags"
  | "isDateNight"
  | "optionalLink"
  | "optionalImage"
  | "optionalLocation"
  | "coverPresetId"
  | "proposedStartDate"
  | "proposedStartTime"
  | "proposedEndDate"
  | "proposedEndTime"
>;

type StoredIdeaDraft = {
  version: 1;
  savedAt: number;
  baseUpdatedAt?: string;
  values: EditableIdea;
};

export type LoadedIdeaDraft =
  | { status: "none" }
  | { status: "stale" }
  | { status: "restored"; idea: Idea };

export function editableIdeaValues(idea: Idea): EditableIdea {
  return {
    title: idea.title,
    description: idea.description,
    category: idea.category,
    status: idea.status,
    tags: [...idea.tags],
    isDateNight: idea.isDateNight,
    optionalLink: idea.optionalLink,
    optionalImage: idea.optionalImage,
    optionalLocation: idea.optionalLocation,
    coverPresetId: idea.coverPresetId,
    proposedStartDate: idea.proposedStartDate,
    proposedStartTime: idea.proposedStartTime,
    proposedEndDate: idea.proposedEndDate,
    proposedEndTime: idea.proposedEndTime,
  };
}

export function ideaHasUnsavedChanges(current: Idea, baseline: Idea) {
  return JSON.stringify(editableIdeaValues(current)) !== JSON.stringify(editableIdeaValues(baseline));
}

export function ideaDraftKey(scope: IdeaDraftScope) {
  const record = scope.mode === "create"
    ? "new"
    : scope.mode === "edit"
      ? scope.ideaId || "unknown"
      : `duplicate:${scope.ideaId || "unknown"}`;
  return `our-adventures:idea-draft:v${DRAFT_VERSION}:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.spaceId)}:${scope.mode}:${encodeURIComponent(record)}`;
}

function isStoredDraft(value: unknown): value is StoredIdeaDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<StoredIdeaDraft>;
  const values = draft.values as Partial<EditableIdea> | undefined;
  return (
    draft.version === DRAFT_VERSION &&
    typeof draft.savedAt === "number" &&
    Boolean(values) &&
    typeof values?.title === "string" &&
    typeof values.description === "string" &&
    typeof values.category === "string" &&
    typeof values.status === "string" &&
    Array.isArray(values.tags) &&
    values.tags.every((tag) => typeof tag === "string") &&
    typeof values.isDateNight === "boolean"
    && (values.optionalLink === undefined || typeof values.optionalLink === "string")
  );
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
  };
  storage.setItem(ideaDraftKey(scope), JSON.stringify(payload));
}

export function loadIdeaDraft(
  storage: Storage,
  scope: IdeaDraftScope,
  serverIdea: Idea,
  now = Date.now(),
): LoadedIdeaDraft {
  const key = ideaDraftKey(scope);
  const raw = storage.getItem(key);
  if (!raw) return { status: "none" };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredDraft(parsed) || now - parsed.savedAt > IDEA_DRAFT_MAX_AGE_MS) {
      storage.removeItem(key);
      return { status: "none" };
    }
    if (
      scope.mode === "edit" &&
      parsed.baseUpdatedAt !== undefined &&
      parsed.baseUpdatedAt !== serverIdea.updatedAt
    ) {
      storage.removeItem(key);
      return { status: "stale" };
    }
    return { status: "restored", idea: { ...serverIdea, ...parsed.values } };
  } catch {
    storage.removeItem(key);
    return { status: "none" };
  }
}

export function clearIdeaDraft(storage: Storage, scope: IdeaDraftScope) {
  storage.removeItem(ideaDraftKey(scope));
}
