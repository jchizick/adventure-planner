import { describe, expect, it } from "vitest";
import {
  defaultMemoryViewState,
  filterAndSortMemories,
  filterMemories,
  getMemoryRatingMetrics,
  parseMemoryViewParams,
  qualifiesForWouldDoAgain,
  selectOurFavourites,
  serializeMemoryViewParams,
  sortMemories,
  type MemoryViewState,
} from "./memory-rating-model";
import type {
  Adventure,
  AdventureRatingSummary,
  MemorySummary,
} from "./types";

function adventure({
  id,
  completedAt,
  endDate,
  category = "culture",
  tags = [],
}: {
  id: string;
  completedAt?: string;
  endDate?: string;
  category?: Adventure["category"];
  tags?: string[];
}): Adventure {
  return {
    id,
    title: `Memory ${id}`,
    description: "",
    date: "2026-01-01",
    endDate,
    startTime: "",
    endTime: "",
    status: "Completed",
    location: "",
    savedLocation: { kind: "text", label: "" },
    category,
    tags,
    stops: [],
    notes: "",
    links: [],
    checklist: [],
    addedBy: "Member",
    updatedBy: "Member",
    completed: true,
    completedAt,
    favorite: false,
  };
}

function rating({
  average,
  count,
  yes = 0,
  no = 0,
}: {
  average: number | null;
  count: number;
  yes?: number;
  no?: number;
}): AdventureRatingSummary {
  return {
    average,
    count,
    wouldDoAgainYes: yes,
    wouldDoAgainNo: no,
    wouldDoAgainUnanswered: count - yes - no,
  };
}

function summary(
  adventureId: string,
  aggregate: AdventureRatingSummary,
): MemorySummary {
  return {
    adventureId,
    reflection: "",
    photoCount: 0,
    rating: aggregate,
  };
}

function ids(adventures: Adventure[]) {
  return adventures.map((item) => item.id);
}

describe("Memory rating metrics", () => {
  it("derives honest unrated, one-rating, and multiple-rating metrics", () => {
    expect(getMemoryRatingMetrics()).toEqual({
      averageRating: null,
      ratingCount: 0,
      wouldDoAgainYes: 0,
      wouldDoAgainNo: 0,
      wouldDoAgainAnswered: 0,
      allAnsweredWouldDoAgain: false,
      sharedFavouriteEligible: false,
    });
    expect(getMemoryRatingMetrics(summary("one", rating({
      average: 5,
      count: 1,
      yes: 1,
    })))).toMatchObject({
      averageRating: 5,
      ratingCount: 1,
      wouldDoAgainAnswered: 1,
      allAnsweredWouldDoAgain: true,
      sharedFavouriteEligible: true,
    });
    expect(getMemoryRatingMetrics(summary("many", rating({
      average: 4.5,
      count: 3,
      yes: 2,
    })))).toMatchObject({
      ratingCount: 3,
      wouldDoAgainAnswered: 2,
      allAnsweredWouldDoAgain: false,
      sharedFavouriteEligible: true,
    });
  });

  it("uses conservative Would Do Again semantics", () => {
    expect(qualifiesForWouldDoAgain(summary("yes", rating({
      average: 4,
      count: 1,
      yes: 1,
    })))).toBe(true);
    expect(qualifiesForWouldDoAgain(summary("no", rating({
      average: 4,
      count: 1,
      no: 1,
    })))).toBe(false);
    expect(qualifiesForWouldDoAgain(summary("yes-unanswered", rating({
      average: 4,
      count: 2,
      yes: 1,
    })))).toBe(true);
    expect(qualifiesForWouldDoAgain(summary("mixed", rating({
      average: 4,
      count: 2,
      yes: 1,
      no: 1,
    })))).toBe(false);
    expect(qualifiesForWouldDoAgain(summary("unanswered", rating({
      average: 4,
      count: 1,
    })))).toBe(false);
    expect(qualifiesForWouldDoAgain()).toBe(false);
  });
});

describe("Memory sorting", () => {
  it("sorts Highest Rated by average, count, effective date, then stable ID", () => {
    const memories = [
      adventure({ id: "unrated", completedAt: "2026-06-01T12:00:00Z" }),
      adventure({ id: "five-one", completedAt: "2026-05-01T12:00:00Z" }),
      adventure({ id: "five-two", completedAt: "2026-04-01T12:00:00Z" }),
      adventure({ id: "four-five", completedAt: "2026-07-01T12:00:00Z" }),
      adventure({ id: "date-new", completedAt: "2026-03-02T12:00:00Z" }),
      adventure({ id: "date-old", completedAt: "2026-03-01T12:00:00Z" }),
      adventure({ id: "a-stable", completedAt: "2026-02-01T12:00:00Z" }),
      adventure({ id: "b-stable", completedAt: "2026-02-01T12:00:00Z" }),
    ];
    const summaries = {
      "five-one": summary("five-one", rating({ average: 5, count: 1 })),
      "five-two": summary("five-two", rating({ average: 5, count: 2 })),
      "four-five": summary("four-five", rating({ average: 4.5, count: 2 })),
      "date-new": summary("date-new", rating({ average: 4, count: 2 })),
      "date-old": summary("date-old", rating({ average: 4, count: 2 })),
      "a-stable": summary("a-stable", rating({ average: 3, count: 1 })),
      "b-stable": summary("b-stable", rating({ average: 3, count: 1 })),
    };

    expect(ids(sortMemories(memories, summaries, "highest-rated"))).toEqual([
      "five-two",
      "five-one",
      "four-five",
      "date-new",
      "date-old",
      "a-stable",
      "b-stable",
      "unrated",
    ]);
  });

  it("sorts Most Rated by count before average and keeps unrated deterministic", () => {
    const memories = [
      adventure({ id: "unrated-b", completedAt: "2026-01-01T12:00:00Z" }),
      adventure({ id: "high-average", completedAt: "2026-04-01T12:00:00Z" }),
      adventure({ id: "many", completedAt: "2026-03-01T12:00:00Z" }),
      adventure({ id: "unrated-a", completedAt: "2026-02-01T12:00:00Z" }),
    ];
    const summaries = {
      "high-average": summary("high-average", rating({ average: 5, count: 1 })),
      many: summary("many", rating({ average: 4, count: 3 })),
    };
    expect(ids(sortMemories(memories, summaries, "most-rated"))).toEqual([
      "many",
      "high-average",
      "unrated-a",
      "unrated-b",
    ]);
  });

  it("keeps Most Recent as default and supports Oldest using completion/end dates", () => {
    const memories = [
      adventure({ id: "middle", endDate: "2026-02-01" }),
      adventure({ id: "newest", completedAt: "2026-03-01T12:00:00Z" }),
      adventure({ id: "oldest", endDate: "2026-01-02" }),
    ];
    expect(ids(sortMemories(
      memories,
      {},
      defaultMemoryViewState.sort,
    ))).toEqual(["newest", "middle", "oldest"]);
    expect(ids(sortMemories(memories, {}, "oldest")))
      .toEqual(["oldest", "middle", "newest"]);
  });

  it("keeps an all-unrated Highest Rated view in chronological order", () => {
    const memories = [
      adventure({ id: "old", completedAt: "2026-01-01T12:00:00Z" }),
      adventure({ id: "new", completedAt: "2026-02-01T12:00:00Z" }),
    ];
    expect(ids(sortMemories(memories, {}, "highest-rated")))
      .toEqual(["new", "old"]);
  });
});

describe("Our Favourites", () => {
  it("requires average 4+, at least one Yes, and no No", () => {
    const memories = [
      adventure({ id: "below" }),
      adventure({ id: "qualifies" }),
      adventure({ id: "has-no" }),
      adventure({ id: "no-yes" }),
    ];
    const summaries = {
      below: summary("below", rating({ average: 3.9, count: 1, yes: 1 })),
      qualifies: summary("qualifies", rating({ average: 4, count: 2, yes: 1 })),
      "has-no": summary("has-no", rating({
        average: 5,
        count: 2,
        yes: 1,
        no: 1,
      })),
      "no-yes": summary("no-yes", rating({ average: 5, count: 1 })),
    };
    expect(ids(selectOurFavourites(memories, summaries))).toEqual(["qualifies"]);
  });

  it("orders favourites by average, count, Yes count, date, then stable ID", () => {
    const memories = [
      adventure({ id: "average", completedAt: "2026-01-01T12:00:00Z" }),
      adventure({ id: "count", completedAt: "2026-01-01T12:00:00Z" }),
      adventure({ id: "yes", completedAt: "2026-01-01T12:00:00Z" }),
      adventure({ id: "date", completedAt: "2026-02-01T12:00:00Z" }),
      adventure({ id: "a-stable", completedAt: "2026-01-01T12:00:00Z" }),
      adventure({ id: "b-stable", completedAt: "2026-01-01T12:00:00Z" }),
    ];
    const summaries = {
      average: summary("average", rating({ average: 5, count: 1, yes: 1 })),
      count: summary("count", rating({ average: 4.5, count: 3, yes: 1 })),
      yes: summary("yes", rating({ average: 4.5, count: 2, yes: 2 })),
      date: summary("date", rating({ average: 4.5, count: 2, yes: 1 })),
      "a-stable": summary("a-stable", rating({ average: 4, count: 1, yes: 1 })),
      "b-stable": summary("b-stable", rating({ average: 4, count: 1, yes: 1 })),
    };
    expect(ids(selectOurFavourites(memories, summaries))).toEqual([
      "average",
      "count",
      "yes",
      "date",
      "a-stable",
      "b-stable",
    ]);
  });
});

describe("Memory filters and URL state", () => {
  const dateNight = adventure({
    id: "date-night",
    category: "food-drink",
    tags: ["date-night"],
  });
  const rainyOutdoors = adventure({
    id: "rainy-outdoors",
    category: "outdoors",
    tags: ["rainy-day"],
  });
  const seasonalOutdoors = adventure({
    id: "seasonal-outdoors",
    category: "outdoors",
    tags: ["seasonal"],
  });
  const summaries = {
    "date-night": summary("date-night", rating({
      average: 5,
      count: 1,
      yes: 1,
    })),
    "rainy-outdoors": summary("rainy-outdoors", rating({
      average: 4,
      count: 2,
      yes: 1,
      no: 1,
    })),
  };

  it("supports Rated, Unrated, and conservative Would Do Again filters", () => {
    const memories = [dateNight, rainyOutdoors, seasonalOutdoors];
    expect(ids(filterMemories(memories, summaries, {
      rating: "rated",
      tags: [],
      category: null,
    }))).toEqual(["date-night", "rainy-outdoors"]);
    expect(ids(filterMemories(memories, summaries, {
      rating: "unrated",
      tags: [],
      category: null,
    }))).toEqual(["seasonal-outdoors"]);
    expect(ids(filterMemories(memories, summaries, {
      rating: "would-do-again",
      tags: [],
      category: null,
    }))).toEqual(["date-night"]);
  });

  it("uses OR tags, then combines category and rating with AND semantics", () => {
    const view: MemoryViewState = {
      sort: "highest-rated",
      filters: {
        rating: "unrated",
        tags: ["rainy-day", "seasonal"],
        category: "outdoors",
      },
    };
    expect(ids(filterAndSortMemories(
      [dateNight, rainyOutdoors, seasonalOutdoors],
      summaries,
      view,
    ))).toEqual(["seasonal-outdoors"]);
  });

  it("normalizes invalid URL values and writes canonical, shareable parameters", () => {
    expect(parseMemoryViewParams(new URLSearchParams(
      "sort=best&rating=maybe&category=unknown&tags=seasonal,date-night,unknown",
    ))).toEqual({
      sort: "most-recent",
      filters: {
        rating: "all",
        category: null,
        tags: ["date-night", "seasonal"],
      },
    });

    const params = serializeMemoryViewParams({
      sort: "highest-rated",
      filters: {
        rating: "would-do-again",
        category: "outdoors",
        tags: ["seasonal", "date-night"],
      },
    });
    expect(params.toString()).toBe(
      "sort=highest-rated&rating=would-do-again&tags=date-night%2Cseasonal&category=outdoors",
    );
    expect(parseMemoryViewParams(params).filters.rating)
      .toBe("would-do-again");
  });
});
