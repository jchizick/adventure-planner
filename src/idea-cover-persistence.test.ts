import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdeaDraft } from "./repositories/ideas";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("./lib/supabase", () => ({ supabase: { from: mocks.from } }));

import { createIdea, updateIdea } from "./repositories/ideas";

const ideaId =
  "00000000-0000-4000-8000-000000000001" as `${string}-${string}-${string}-${string}-${string}`;

function draft(overrides: Partial<IdeaDraft> = {}): IdeaDraft {
  return {
    title: "Restaurant dinner",
    description: "Try somewhere new",
    category: "food-drink",
    status: "Idea",
    tags: [],
    isDateNight: false,
    ...overrides,
  };
}

function row(coverPresetId: string | null) {
  return {
    id: ideaId,
    space_id: "space-id",
    title: "Restaurant dinner",
    description: "Try somewhere new",
    category: "food-drink",
    status: "idea" as const,
    tags: [],
    optional_link: null,
    image_url: null,
    cover_preset_id: coverPresetId,
    location: null,
    added_by: "user-id",
    linked_adventure_id: null,
    created_at: "2026-07-15T12:00:00Z",
    updated_at: "2026-07-15T12:00:00Z",
    is_date_night: false,
    linked_adventure: null,
    added_by_profile: { display_name: "Member" },
  };
}

function createQuery(result = row("food-dinner")) {
  const single = vi.fn().mockResolvedValue({ data: result, error: null });
  const select = vi
    .fn<(columns: string) => { single: typeof single }>()
    .mockImplementation(() => ({ single }));
  const insert = vi
    .fn<(payload: Record<string, unknown>) => { select: typeof select }>()
    .mockImplementation(() => ({ select }));
  mocks.from.mockReturnValue({ insert });
  return { insert, select };
}

function updateQuery(result: ReturnType<typeof row>) {
  const single = vi.fn().mockResolvedValue({ data: result, error: null });
  const select = vi
    .fn<(columns: string) => { single: typeof single }>()
    .mockImplementation(() => ({ single }));
  const eqSpace = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqSpace }));
  const update = vi
    .fn<(payload: Record<string, unknown>) => { eq: typeof eqId }>()
    .mockImplementation(() => ({ eq: eqId }));
  mocks.from.mockReturnValue({ update });
  return { update, eqId, eqSpace };
}

beforeEach(() => {
  mocks.from.mockReset();
  vi.restoreAllMocks();
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(ideaId);
});

describe("Idea cover persistence", () => {
  it("inserts a client-generated ID and automatic preset atomically", async () => {
    const query = createQuery();
    const created = await createIdea("space-id", "user-id", draft());

    expect(query.insert).toHaveBeenCalledTimes(1);
    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ideaId,
        space_id: "space-id",
        added_by: "user-id",
        cover_preset_id: "food-dinner",
      }),
    );
    expect(query.select.mock.calls[0][0]).toContain("cover_preset_id");
    expect(created.coverPresetId).toBe("food-dinner");
  });

  it("allows a recognized supplied preset to win during creation", async () => {
    const query = createQuery(row("home-journal"));
    await createIdea(
      "space-id",
      "user-id",
      draft({
        coverPresetId: "home-journal",
      }),
    );

    expect(query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        cover_preset_id: "home-journal",
      }),
    );
  });

  it("preserves a recognized preset during edits", async () => {
    const query = updateQuery(row("culture-gallery"));
    const updated = await updateIdea(
      "space-id",
      ideaId,
      draft({
        coverPresetId: "culture-gallery",
      }),
    );

    expect(query.update).toHaveBeenCalledWith(
      expect.objectContaining({
        cover_preset_id: "culture-gallery",
      }),
    );
    expect(updated.coverPresetId).toBe("culture-gallery");
  });

  it("leaves an existing null preset null during ordinary edits", async () => {
    const query = updateQuery(row(null));
    const updated = await updateIdea("space-id", ideaId, draft());
    const payload = query.update.mock.calls[0][0] as Record<string, unknown>;

    expect(payload).not.toHaveProperty("cover_preset_id");
    expect(updated.coverPresetId).toBeUndefined();
  });
});
