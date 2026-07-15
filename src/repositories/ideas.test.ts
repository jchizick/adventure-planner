import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { from: mocks.from },
}));

import { deleteIdea } from "./ideas";

function deleteQuery(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqId = vi.fn(() => ({ select }));
  const eqSpace = vi.fn(() => ({ eq: eqId }));
  const remove = vi.fn(() => ({ eq: eqSpace }));
  mocks.from.mockReturnValue({ delete: remove });
  return { remove, eqSpace, eqId, select, maybeSingle };
}

beforeEach(() => {
  mocks.from.mockReset();
});

describe("deleteIdea", () => {
  it("deletes one Idea scoped to its space and requires the deleted row", async () => {
    const query = deleteQuery({ data: { id: "idea-id" }, error: null });

    await deleteIdea("space-id", "idea-id");

    expect(mocks.from).toHaveBeenCalledWith("ideas");
    expect(query.remove).toHaveBeenCalledTimes(1);
    expect(query.eqSpace).toHaveBeenCalledWith("space_id", "space-id");
    expect(query.eqId).toHaveBeenCalledWith("id", "idea-id");
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("treats an RLS-filtered or missing row as a recoverable failure", async () => {
    deleteQuery({ data: null, error: null });

    await expect(deleteIdea("space-id", "idea-id")).rejects.toThrow(
      "We could not delete this idea. Please try again.",
    );
  });
});
