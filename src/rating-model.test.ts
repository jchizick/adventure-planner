import { describe, expect, it } from "vitest";
import {
  formatRatingAverage,
  formatRatingCount,
  formatWouldDoAgainSummary,
  orderAdventureRatings,
  summarizeAdventureRatings,
} from "./rating-model";
import type { AdventureRatingWithMember } from "./types";

describe("Adventure rating summaries", () => {
  it("returns an empty transparent summary", () => {
    expect(summarizeAdventureRatings([])).toEqual({
      average: null,
      count: 0,
      wouldDoAgainYes: 0,
      wouldDoAgainNo: 0,
      wouldDoAgainUnanswered: 0,
    });
  });

  it("uses every score and preserves yes, no, and unanswered counts", () => {
    const summary = summarizeAdventureRatings([
      { rating: 5, wouldDoAgain: true },
      { rating: 4, wouldDoAgain: false },
      { rating: 3, wouldDoAgain: null },
    ]);
    expect(summary).toEqual({
      average: 4,
      count: 3,
      wouldDoAgainYes: 1,
      wouldDoAgainNo: 1,
      wouldDoAgainUnanswered: 1,
    });
    expect(formatWouldDoAgainSummary(summary)).toBe("1 yes · 1 no");
  });

  it("formats decimal averages, singular counts, and all-yes answers", () => {
    const summary = summarizeAdventureRatings([
      { rating: 5, wouldDoAgain: true },
      { rating: 4, wouldDoAgain: true },
    ]);
    expect(formatRatingAverage(summary.average!)).toBe("4.5");
    expect(formatRatingCount(1)).toBe("1 rating");
    expect(formatRatingCount(2)).toBe("2 ratings");
    expect(formatWouldDoAgainSummary(summary))
      .toBe("Everyone who answered would do it again");
    expect(formatWouldDoAgainSummary(summarizeAdventureRatings([
      { rating: 5, wouldDoAgain: null },
    ]))).toBeNull();
  });

  it("orders the current member first and other members deterministically", () => {
    const base = {
      adventureId: "adventure",
      wouldDoAgain: null,
      note: null,
      createdAt: "2026-07-24T00:00:00Z",
      updatedAt: "2026-07-24T00:00:00Z",
      memberAvatarUrl: null,
    };
    const ratings: AdventureRatingWithMember[] = [
      { ...base, id: "2", userId: "liz", rating: 4, memberName: "Liz" },
      { ...base, id: "1", userId: "jordan", rating: 5, memberName: "Jordan" },
      { ...base, id: "3", userId: null, rating: 3, memberName: "Former member" },
    ];
    expect(orderAdventureRatings(ratings, "jordan").map((item) => item.id))
      .toEqual(["1", "3", "2"]);
  });
});
