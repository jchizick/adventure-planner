import type { Idea } from "./types";

export function selectRecentIdeas(ideas: readonly Idea[], limit = 3) {
  return [...ideas]
    .sort((left, right) => {
      const createdOrder = right.createdAt.localeCompare(left.createdAt);
      return createdOrder || left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}
