// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Idea } from "./types";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  uploadCoverFile: vi.fn(),
  removeCoverObject: vi.fn(),
  bestEffortCoverCleanup: vi.fn(),
}));

vi.mock("./lib/supabase", () => ({ supabase: { from: mocks.from } }));
vi.mock("./cover-storage", () => ({
  uploadCoverFile: mocks.uploadCoverFile,
  removeCoverObject: mocks.removeCoverObject,
  bestEffortCoverCleanup: mocks.bestEffortCoverCleanup,
  signedCoverUrl: vi.fn(),
}));

import { updateIdea } from "./repositories/ideas";

const previous: Idea = {
  id: "idea-id",
  title: "Picnic",
  description: "By the lake",
  category: "outdoors",
  status: "Idea",
  tags: [],
  addedBy: "Member",
  isDateNight: false,
  createdAt: "2026-07-17T12:00:00Z",
  coverStoragePath: "spaces/space-id/ideas/idea-id/cover/old.jpg",
  coverUrl: "https://signed.example/old",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.uploadCoverFile.mockResolvedValue(
    "spaces/space-id/ideas/idea-id/cover/new.jpg",
  );
  mocks.removeCoverObject.mockResolvedValue(undefined);
  const single = vi.fn().mockResolvedValue({
    data: null,
    error: { message: "database unavailable" },
  });
  const select = vi.fn(() => ({ single }));
  const eqSpace = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqSpace }));
  const update = vi.fn(() => ({ eq: eqId }));
  mocks.from.mockReturnValue({ update });
});

describe("cover replacement failure handling", () => {
  it("removes the newly uploaded object and leaves the prior reference untouched", async () => {
    const file = new File([new Uint8Array([1])], "new.jpg", { type: "image/jpeg" });
    await expect(updateIdea(
      "space-id",
      previous.id,
      {
        ...previous,
        coverPresetId: null,
        pendingCoverFile: file,
      },
      previous,
    )).rejects.toThrow("We could not update this idea");

    expect(mocks.removeCoverObject).toHaveBeenCalledWith(
      "spaces/space-id/ideas/idea-id/cover/new.jpg",
    );
    expect(mocks.bestEffortCoverCleanup).not.toHaveBeenCalled();
    expect(previous.coverStoragePath).toContain("/old.jpg");
  });
});
