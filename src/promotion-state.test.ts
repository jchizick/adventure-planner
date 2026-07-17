import { describe, expect, it, vi } from "vitest";
import { emptyAdvancedIdeaFilters, filterIdeas, selectCalendarProposalIdeas } from "./idea-model";
import { promoteAndReconcileIdea, reconcilePromotedIdea, upsertPromotedAdventure } from "./promotion-state";
import type { Adventure, AdventurePlanInput, Idea } from "./types";

const idea: Idea = {
  id: "idea-1",
  title: "Cabin weekend",
  description: "A quiet weekend away",
  category: "trips-getaways",
  status: "Tentative",
  tags: [],
  addedBy: "Planner",
  isDateNight: false,
  createdAt: "2026-07-17T00:00:00Z",
  proposedStartDate: "2026-08-14",
  proposedStartTime: "16:00",
  proposedEndDate: "2026-08-16",
  proposedEndTime: "11:00",
};

const adventure = {
  id: "adventure-1",
  date: "2026-08-14",
} as Adventure;

const plan = {
  title: idea.title,
  description: idea.description,
  date: "2026-08-14",
  endDate: "2026-08-16",
  startTime: "16:00",
  endTime: "11:00",
  status: "Tentative",
  location: "",
  notes: "",
} satisfies AdventurePlanInput;

describe("promotion state reconciliation", () => {
  it("immediately removes a promoted Idea from active Saved Ideas and proposals while preserving it as Planned", () => {
    const reconciled = reconcilePromotedIdea([idea], idea.id, adventure);
    expect(filterIdeas(reconciled, "all", "", emptyAdvancedIdeaFilters)).toEqual([]);
    expect(selectCalendarProposalIdeas(reconciled)).toEqual([]);
    expect(reconciled).toEqual([expect.objectContaining({
      id: idea.id,
      status: "Confirmed",
      linkedAdventureId: adventure.id,
      scheduledFor: adventure.date,
      proposedStartDate: undefined,
      proposedEndDate: undefined,
    })]);
  });

  it("adds the promoted Adventure immediately without duplicate client records", () => {
    expect(upsertPromotedAdventure([], adventure)).toEqual([adventure]);
    expect(upsertPromotedAdventure([adventure], adventure)).toEqual([adventure]);
  });

  it("does not reconcile the Idea when the atomic promotion fails", async () => {
    const failure = new Error("Promotion failed");
    const reconcile = vi.fn();
    await expect(promoteAndReconcileIdea({
      ideaId: idea.id,
      plan,
      promote: vi.fn().mockRejectedValue(failure),
      reconcile,
    })).rejects.toThrow("Promotion failed");
    expect(reconcile).not.toHaveBeenCalled();
    expect(filterIdeas([idea], "all", "", emptyAdvancedIdeaFilters)).toEqual([idea]);
    expect(selectCalendarProposalIdeas([idea])).toEqual([idea]);
  });

  it("reconciles only after the Adventure transaction succeeds without a page reload", async () => {
    const reconcile = vi.fn();
    const created = await promoteAndReconcileIdea({
      ideaId: idea.id,
      plan,
      promote: vi.fn().mockResolvedValue(adventure),
      reconcile,
    });
    expect(created).toBe(adventure);
    expect(reconcile).toHaveBeenCalledWith(idea.id, adventure);
  });
});
