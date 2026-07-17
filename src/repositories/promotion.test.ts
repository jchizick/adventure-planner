import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdventurePlanInput } from "../types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc, from: mocks.from },
}));

import { promoteIdea } from "./adventures";

const plan: AdventurePlanInput = {
  title: "Cabin weekend",
  description: "A quiet weekend away",
  date: "2026-08-14",
  endDate: "2026-08-16",
  startTime: "16:00",
  endTime: "11:00",
  status: "Tentative",
  location: "",
  notes: "",
  category: "trips-getaways",
};

const row = {
  id: "adventure-1",
  space_id: "space-1",
  source_idea_id: "idea-1",
  title: plan.title,
  description: plan.description,
  category: plan.category,
  status: "tentative",
  event_date: plan.date,
  end_date: plan.endDate,
  start_time: "16:00:00",
  end_time: "11:00:00",
  location: null,
  latitude: null,
  longitude: null,
  timezone: null,
  geocoded_location: null,
  location_provider: null,
  location_provider_id: null,
  location_address: null,
  location_source: null,
  location_confirmed_at: null,
  notes: null,
  cover_image_url: null,
  cover_variant: null,
  is_favorite: false,
  completed_at: null,
  created_by: "user-1",
  updated_by: "user-1",
  created_at: "2026-07-17T00:00:00Z",
  updated_at: "2026-07-17T00:00:00Z",
};

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.from.mockReset();
});

describe("promotion repository transaction boundary", () => {
  it("returns the Adventure from the atomic RPC without a second database read", async () => {
    mocks.rpc.mockResolvedValue({ data: row, error: null });
    await expect(promoteIdea("space-1", "idea-1", plan)).resolves.toMatchObject({
      id: row.id,
      sourceIdeaId: "idea-1",
      date: plan.date,
      endDate: plan.endDate,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("promote_idea_to_adventure_v3", expect.objectContaining({ p_idea_id: "idea-1" }));
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects on RPC failure without attempting a follow-up read", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "transaction rolled back" } });
    await expect(promoteIdea("space-1", "idea-1", plan)).rejects.toThrow("We could not promote this adventure");
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
