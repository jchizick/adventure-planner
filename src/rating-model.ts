import type {
  AdventureRating,
  AdventureRatingSummary,
  AdventureRatingWithMember,
} from "./types";

export const MAX_ADVENTURE_RATING_NOTE_LENGTH = 500;

export function summarizeAdventureRatings(
  ratings: Pick<AdventureRating, "rating" | "wouldDoAgain">[],
): AdventureRatingSummary {
  let total = 0;
  let wouldDoAgainYes = 0;
  let wouldDoAgainNo = 0;
  for (const item of ratings) {
    total += item.rating;
    if (item.wouldDoAgain === true) wouldDoAgainYes += 1;
    if (item.wouldDoAgain === false) wouldDoAgainNo += 1;
  }
  return {
    average: ratings.length ? total / ratings.length : null,
    count: ratings.length,
    wouldDoAgainYes,
    wouldDoAgainNo,
    wouldDoAgainUnanswered:
      ratings.length - wouldDoAgainYes - wouldDoAgainNo,
  };
}

export function formatRatingAverage(average: number) {
  return Number.isInteger(average) ? average.toFixed(0) : average.toFixed(1);
}

export function formatRatingCount(count: number) {
  return `${count} ${count === 1 ? "rating" : "ratings"}`;
}

export function formatWouldDoAgainSummary(
  summary: AdventureRatingSummary,
): string | null {
  const answered = summary.wouldDoAgainYes + summary.wouldDoAgainNo;
  if (!answered) return null;
  if (summary.wouldDoAgainYes === answered)
    return answered === 1
      ? "1 member would do it again"
      : "Everyone who answered would do it again";
  return `${summary.wouldDoAgainYes} yes · ${summary.wouldDoAgainNo} no`;
}

export function orderAdventureRatings(
  ratings: AdventureRatingWithMember[],
  currentUserId: string,
) {
  return [...ratings].sort((first, second) => {
    const firstIsCurrent = first.userId === currentUserId;
    const secondIsCurrent = second.userId === currentUserId;
    if (firstIsCurrent !== secondIsCurrent) return firstIsCurrent ? -1 : 1;
    const nameOrder = first.memberName.localeCompare(second.memberName);
    return nameOrder || first.createdAt.localeCompare(second.createdAt);
  });
}
