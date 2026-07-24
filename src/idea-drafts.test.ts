// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearIdeaDraft,
  ideaDraftKey,
  ideaHasUnsavedChanges,
  IDEA_DRAFT_MAX_AGE_MS,
  loadIdeaDraft,
  saveIdeaDraft,
  type IdeaDraftScope,
} from "./idea-drafts";
import type { Idea } from "./types";

const idea: Idea = {
  id: "idea-1",
  title: "Museum afternoon",
  description: "See the new exhibit",
  category: "culture",
  status: "Idea",
  tags: [],
  addedBy: "Planner",
  isDateNight: false,
  createdAt: "2026-07-15T12:00:00Z",
  updatedAt: "2026-07-15T12:00:00Z",
};
const scope: IdeaDraftScope = {
  userId: "user-1",
  spaceId: "space-1",
  mode: "edit",
  ideaId: idea.id,
};

beforeEach(() => localStorage.clear());

describe("Idea draft persistence", () => {
  it("isolates create and edit drafts by user and shared space", () => {
    const createScope: IdeaDraftScope = {
      userId: scope.userId,
      spaceId: scope.spaceId,
      mode: "create",
    };
    expect(ideaDraftKey(createScope)).not.toBe(ideaDraftKey(scope));
    expect(ideaDraftKey({ ...createScope, userId: "another-user" })).not.toBe(ideaDraftKey(createScope));
    expect(ideaDraftKey({ ...createScope, spaceId: "another-space" })).not.toBe(ideaDraftKey(createScope));
  });

  it("detects only editable value changes", () => {
    expect(ideaHasUnsavedChanges({ ...idea }, idea)).toBe(false);
    expect(ideaHasUnsavedChanges({ ...idea, title: "Changed" }, idea)).toBe(true);
    expect(ideaHasUnsavedChanges({ ...idea, updatedAt: "later" }, idea)).toBe(false);
    expect(ideaHasUnsavedChanges({ ...idea, optionalLink: "https://example.com" }, idea)).toBe(true);
    expect(ideaHasUnsavedChanges(
      { ...idea, tags: ["seasonal", "date-night"] },
      { ...idea, tags: ["date-night", "seasonal"] },
    )).toBe(false);
    expect(ideaHasUnsavedChanges(
      { ...idea, tags: ["date-night"] },
      idea,
    )).toBe(true);
  });

  it("restores a version-one Date Night draft without a tags field safely", () => {
    const legacyKey = ideaDraftKey(scope).replace(":v2:", ":v1:");
    localStorage.setItem(legacyKey, JSON.stringify({
      version: 1,
      savedAt: 1000,
      baseUpdatedAt: idea.updatedAt,
      values: {
        title: "Legacy date",
        description: idea.description,
        category: "date-night",
        status: idea.status,
        isDateNight: true,
      },
      coverUploadPending: false,
    }));
    const loaded = loadIdeaDraft(localStorage, scope, idea, 2000);
    expect(loaded).toMatchObject({
      status: "restored",
      idea: {
        title: "Legacy date",
        category: "social",
        tags: ["date-night"],
        isDateNight: true,
      },
    });
    expect(localStorage.getItem(legacyKey)).toBeNull();
  });

  it("restores a valid same-user, same-space draft", () => {
    saveIdeaDraft(localStorage, scope, { ...idea, title: "Draft title", optionalLink: "example.com" }, 1000);
    expect(loadIdeaDraft(localStorage, scope, idea, 2000)).toEqual({
      status: "restored",
      idea: { ...idea, title: "Draft title", optionalLink: "example.com", pendingCoverFile: undefined },
      photoNeedsReselection: false,
    });
    expect(localStorage.getItem(ideaDraftKey({ ...scope, userId: "another" }))).toBeNull();
  });

  it("isolates duplicate drafts from original edits and ordinary creation", () => {
    const duplicate = { ...scope, mode: "duplicate" as const };
    const create = { ...scope, mode: "create" as const, ideaId: undefined };
    expect(ideaDraftKey(duplicate)).not.toBe(ideaDraftKey(scope));
    expect(ideaDraftKey(duplicate)).not.toBe(ideaDraftKey(create));
  });

  it("expires old drafts and rejects invalid JSON", () => {
    saveIdeaDraft(localStorage, scope, idea, 1000);
    expect(loadIdeaDraft(localStorage, scope, idea, 1000 + IDEA_DRAFT_MAX_AGE_MS + 1)).toEqual({ status: "none" });
    localStorage.setItem(ideaDraftKey(scope), "not json");
    expect(loadIdeaDraft(localStorage, scope, idea)).toEqual({ status: "none" });
    expect(localStorage.getItem(ideaDraftKey(scope))).toBeNull();
  });

  it("does not restore over newer server data", () => {
    saveIdeaDraft(localStorage, scope, { ...idea, title: "Draft" }, 1000);
    const newer = { ...idea, updatedAt: "2026-07-16T12:00:00Z" };
    expect(loadIdeaDraft(localStorage, scope, newer, 2000)).toEqual({ status: "stale" });
    expect(localStorage.getItem(ideaDraftKey(scope))).toBeNull();
  });

  it("clears only the scoped draft", () => {
    const other = { ...scope, ideaId: "idea-2" };
    saveIdeaDraft(localStorage, scope, idea);
    saveIdeaDraft(localStorage, other, { ...idea, id: "idea-2" });
    clearIdeaDraft(localStorage, scope);
    expect(localStorage.getItem(ideaDraftKey(scope))).toBeNull();
    expect(localStorage.getItem(ideaDraftKey(other))).not.toBeNull();
  });
});
