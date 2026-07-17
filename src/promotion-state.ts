import type { Adventure, AdventurePlanInput, Idea } from "./types";

export function reconcilePromotedIdea(
  ideas: Idea[],
  ideaId: string,
  adventure: Pick<Adventure, "id" | "date">,
) {
  return ideas.map((idea) => idea.id === ideaId ? {
    ...idea,
    status: "Confirmed" as const,
    linkedAdventureId: adventure.id,
    scheduledFor: adventure.date,
    proposedStartDate: undefined,
    proposedStartTime: undefined,
    proposedEndDate: undefined,
    proposedEndTime: undefined,
  } : idea);
}

export function upsertPromotedAdventure(
  adventures: Adventure[],
  created: Adventure,
) {
  const existingIndex = adventures.findIndex((adventure) => adventure.id === created.id);
  if (existingIndex < 0) return [...adventures, created];
  return adventures.map((adventure, index) => index === existingIndex ? created : adventure);
}

export async function promoteAndReconcileIdea({
  ideaId,
  plan,
  promote,
  reconcile,
}: {
  ideaId: string;
  plan: AdventurePlanInput;
  promote: (ideaId: string, plan: AdventurePlanInput) => Promise<Adventure>;
  reconcile: (ideaId: string, adventure: Adventure) => void;
}) {
  const created = await promote(ideaId, plan);
  reconcile(ideaId, created);
  return created;
}
